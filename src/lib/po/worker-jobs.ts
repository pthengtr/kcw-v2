import type { SupabaseClient } from "@supabase/supabase-js";

export type PoSyncSite = "HQ" | "SYP";

export const PO_SYNC_JOB_TYPE = "sync_pomas_podet";
export const INVENTORY_SYNC_JOB_TYPE = "sync_inventory";
export const ICLOW_SYNC_JOB_TYPE = "sync_iclow";
/** Combined PO-related refresh (POMAS/PODET, ICLOW, …) for both site PCs. */
export const PO_RELATED_SYNC_JOB_TYPE = "sync_po_related";
export const WORKER_ONLINE_WINDOW_MS = 30_000;
export const INVENTORY_SYNC_SITES: PoSyncSite[] = ["HQ", "SYP"];
export const ICLOW_SYNC_SITES: PoSyncSite[] = ["HQ", "SYP"];
export const PO_RELATED_SYNC_SITES: PoSyncSite[] = ["HQ", "SYP"];

export const HQ_WORKER_CANDIDATES = ["HQ-UBUNTU-SERVER", "HQ-PC"] as const;
export type PoWorkerName = (typeof HQ_WORKER_CANDIDATES)[number] | "SYP-PC";

const SITE_WORKER: Record<PoSyncSite, Extract<PoWorkerName, "HQ-PC" | "SYP-PC">> = {
  HQ: "HQ-PC",
  SYP: "SYP-PC",
};

export function workerNamesForSite(site: PoSyncSite): PoWorkerName[] {
  return site === "HQ" ? [...HQ_WORKER_CANDIDATES] : ["SYP-PC"];
}

export type WorkerHeartbeatRow = {
  worker_name: string;
  last_seen: string;
  status: string | null;
};

export type JobQueueRow = {
  id: number;
  job_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  worker_name: string | null;
  requested_by: string | null;
  source: string | null;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_message: string | null;
  error_message: string | null;
};

export function workerNameForSite(site: PoSyncSite) {
  return SITE_WORKER[site];
}

export function isWorkerOnline(
  lastSeen: string | null | undefined,
  now = Date.now()
) {
  if (!lastSeen) return false;
  const ts = new Date(lastSeen).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts <= WORKER_ONLINE_WINDOW_MS;
}

function mapJob(row: Record<string, unknown>): JobQueueRow {
  return {
    id: Number(row.id),
    job_type: String(row.job_type ?? ""),
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    status: String(row.status ?? ""),
    worker_name: (row.worker_name as string | null) ?? null,
    requested_by: (row.requested_by as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    requested_at: String(row.requested_at ?? ""),
    started_at: (row.started_at as string | null) ?? null,
    finished_at: (row.finished_at as string | null) ?? null,
    result_message: (row.result_message as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
  };
}

export async function pickLiveHqWorkerName(
  supabase: SupabaseClient
): Promise<string | null> {
  for (const workerName of HQ_WORKER_CANDIDATES) {
    const heartbeat = await getWorkerHeartbeat(supabase, workerName);
    if (isWorkerOnline(heartbeat?.last_seen ?? null)) {
      return workerName;
    }
  }
  return null;
}

export async function isSiteWorkerOnline(
  supabase: SupabaseClient,
  site: PoSyncSite
): Promise<{ online: boolean; workerName: PoWorkerName; lastSeen: string | null }> {
  let lastSeen: string | null = null;
  let lastName: PoWorkerName = workerNameForSite(site);
  for (const workerName of workerNamesForSite(site)) {
    const heartbeat = await getWorkerHeartbeat(supabase, workerName);
    lastName = workerName;
    lastSeen = heartbeat?.last_seen ?? lastSeen;
    if (isWorkerOnline(heartbeat?.last_seen ?? null)) {
      return { online: true, workerName, lastSeen: heartbeat?.last_seen ?? null };
    }
  }
  return { online: false, workerName: lastName, lastSeen };
}

export async function getWorkerHeartbeat(
  supabase: SupabaseClient,
  workerName: string
): Promise<WorkerHeartbeatRow | null> {
  const { data, error } = await supabase.rpc("fn_po_worker_heartbeat", {
    p_worker_name: workerName,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    worker_name: String(row.worker_name),
    last_seen: String(row.last_seen),
    status: (row.status as string | null) ?? null,
  };
}

export async function findInFlightPoSync(
  supabase: SupabaseClient,
  site: PoSyncSite
): Promise<JobQueueRow | null> {
  const { data, error } = await supabase.rpc("fn_po_find_inflight_sync", {
    p_site: site,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapJob(row as Record<string, unknown>);
}

export async function enqueuePoSync(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  requestedBy: string;
}): Promise<
  | { alreadyRunning: true; job: JobQueueRow }
  | { alreadyRunning: false; job: JobQueueRow; workerOnline: true }
  | {
      alreadyRunning: false;
      workerOnline: false;
      workerName: string;
      lastSeen: string | null;
    }
> {
  const { supabase, site, requestedBy } = params;
  const preferred =
    site === "HQ"
      ? (await pickLiveHqWorkerName(supabase)) ?? workerNameForSite(site)
      : workerNameForSite(site);
  const workerName = preferred;

  const inFlight = await findInFlightPoSync(supabase, site);
  if (inFlight) {
    return { alreadyRunning: true, job: inFlight };
  }

  const siteHb = await isSiteWorkerOnline(supabase, site);
  if (!siteHb.online) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      workerName: siteHb.workerName,
      lastSeen: siteHb.lastSeen,
    };
  }

  const { data, error } = await supabase.rpc("fn_po_enqueue_sync", {
    p_site: site,
    p_worker_name: workerName,
    p_requested_by: requestedBy,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Enqueue returned no row");
  return {
    alreadyRunning: false,
    workerOnline: true,
    job: mapJob(row as Record<string, unknown>),
  };
}

export async function getJobById(
  supabase: SupabaseClient,
  jobId: number
): Promise<JobQueueRow | null> {
  const { data, error } = await supabase.rpc("fn_po_get_job", {
    p_job_id: jobId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapJob(row as Record<string, unknown>);
}

export async function findInFlightInventorySync(
  supabase: SupabaseClient
): Promise<JobQueueRow[]> {
  const { data, error } = await supabase.rpc("fn_inventory_find_inflight_sync");
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map((row) => mapJob(row as Record<string, unknown>));
}

export async function enqueueInventorySync(params: {
  supabase: SupabaseClient;
  requestedBy: string;
}): Promise<
  | { alreadyRunning: true; jobs: JobQueueRow[] }
  | { alreadyRunning: false; jobs: JobQueueRow[]; workerOnline: true }
  | {
      alreadyRunning: false;
      workerOnline: false;
      offlineWorkers: Array<{
        workerName: string;
        site: PoSyncSite;
        lastSeen: string | null;
      }>;
    }
> {
  const { supabase, requestedBy } = params;

  const running = await findInFlightInventorySync(supabase);
  if (running.length > 0) {
    return { alreadyRunning: true, jobs: running };
  }

  // Gate like bank: need at least one PC online; still enqueue both site jobs.
  const heartbeats = await Promise.all(
    INVENTORY_SYNC_SITES.map(async (site) => {
      const hb = await isSiteWorkerOnline(supabase, site);
      return {
        site,
        workerName: hb.workerName,
        lastSeen: hb.lastSeen,
        online: hb.online,
      };
    })
  );
  const offlineWorkers = heartbeats
    .filter((h) => !h.online)
    .map((h) => ({
      workerName: h.workerName,
      site: h.site,
      lastSeen: h.lastSeen,
    }));
  if (offlineWorkers.length === INVENTORY_SYNC_SITES.length) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      offlineWorkers,
    };
  }

  const { data, error } = await supabase.rpc("fn_inventory_enqueue_sync", {
    p_requested_by: requestedBy,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) throw new Error("Inventory enqueue returned no rows");

  return {
    alreadyRunning: false,
    workerOnline: true,
    jobs: rows.map((row) => mapJob(row as Record<string, unknown>)),
  };
}

export async function fetchInventoryLastUpdatedAt(
  supabase: SupabaseClient,
  branch: PoSyncSite = "HQ"
): Promise<string | null> {
  const { data, error } = await supabase.rpc("fn_inventory_last_updated_at", {
    p_branch: branch,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function findInFlightIclowSync(
  supabase: SupabaseClient
): Promise<JobQueueRow[]> {
  const { data, error } = await supabase.rpc("fn_iclow_find_inflight_sync");
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map((row) => mapJob(row as Record<string, unknown>));
}

export async function enqueueIclowSync(params: {
  supabase: SupabaseClient;
  requestedBy: string;
}): Promise<
  | { alreadyRunning: true; jobs: JobQueueRow[] }
  | { alreadyRunning: false; jobs: JobQueueRow[]; workerOnline: true }
  | {
      alreadyRunning: false;
      workerOnline: false;
      offlineWorkers: Array<{
        workerName: string;
        site: PoSyncSite;
        lastSeen: string | null;
      }>;
    }
> {
  const { supabase, requestedBy } = params;

  const running = await findInFlightIclowSync(supabase);
  if (running.length > 0) {
    return { alreadyRunning: true, jobs: running };
  }

  const heartbeats = await Promise.all(
    ICLOW_SYNC_SITES.map(async (site) => {
      const hb = await isSiteWorkerOnline(supabase, site);
      return {
        site,
        workerName: hb.workerName,
        lastSeen: hb.lastSeen,
        online: hb.online,
      };
    })
  );
  const offlineWorkers = heartbeats
    .filter((h) => !h.online)
    .map((h) => ({
      workerName: h.workerName,
      site: h.site,
      lastSeen: h.lastSeen,
    }));
  if (offlineWorkers.length === ICLOW_SYNC_SITES.length) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      offlineWorkers,
    };
  }

  const { data, error } = await supabase.rpc("fn_iclow_enqueue_sync", {
    p_requested_by: requestedBy,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) throw new Error("ICLOW enqueue returned no rows");

  return {
    alreadyRunning: false,
    workerOnline: true,
    jobs: rows.map((row) => mapJob(row as Record<string, unknown>)),
  };
}

export async function fetchIclowLastIngestedAt(
  supabase: SupabaseClient,
  site: PoSyncSite = "HQ"
): Promise<string | null> {
  const { data, error } = await supabase.rpc("fn_iclow_last_ingested_at", {
    p_site: site,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function findInFlightPoRelatedSync(
  supabase: SupabaseClient
): Promise<JobQueueRow[]> {
  const { data, error } = await supabase.rpc(
    "fn_po_related_find_inflight_sync"
  );
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map((row) => mapJob(row as Record<string, unknown>));
}

export async function enqueuePoRelatedSync(params: {
  supabase: SupabaseClient;
  requestedBy: string;
}): Promise<
  | { alreadyRunning: true; jobs: JobQueueRow[] }
  | { alreadyRunning: false; jobs: JobQueueRow[]; workerOnline: true }
  | {
      alreadyRunning: false;
      workerOnline: false;
      offlineWorkers: Array<{
        workerName: string;
        site: PoSyncSite;
        lastSeen: string | null;
      }>;
    }
> {
  const { supabase, requestedBy } = params;

  const running = await findInFlightPoRelatedSync(supabase);
  if (running.length > 0) {
    return { alreadyRunning: true, jobs: running };
  }

  const heartbeats = await Promise.all(
    PO_RELATED_SYNC_SITES.map(async (site) => {
      const hb = await isSiteWorkerOnline(supabase, site);
      return {
        site,
        workerName: hb.workerName,
        lastSeen: hb.lastSeen,
        online: hb.online,
      };
    })
  );
  const offlineWorkers = heartbeats
    .filter((h) => !h.online)
    .map((h) => ({
      workerName: h.workerName,
      site: h.site,
      lastSeen: h.lastSeen,
    }));
  if (offlineWorkers.length === PO_RELATED_SYNC_SITES.length) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      offlineWorkers,
    };
  }

  const { data, error } = await supabase.rpc("fn_po_related_enqueue_sync", {
    p_requested_by: requestedBy,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    throw new Error("PO-related enqueue returned no rows");
  }

  return {
    alreadyRunning: false,
    workerOnline: true,
    jobs: rows.map((row) => mapJob(row as Record<string, unknown>)),
  };
}
