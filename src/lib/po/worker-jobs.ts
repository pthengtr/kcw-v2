import type { SupabaseClient } from "@supabase/supabase-js";

export type PoSyncSite = "HQ" | "SYP";

export const PO_SYNC_JOB_TYPE = "sync_pomas_podet";
export const INVENTORY_SYNC_JOB_TYPE = "sync_inventory";
export const WORKER_ONLINE_WINDOW_MS = 30_000;
export const INVENTORY_SYNC_SITES: PoSyncSite[] = ["HQ", "SYP"];

const SITE_WORKER: Record<PoSyncSite, "HQ-PC" | "SYP-PC"> = {
  HQ: "HQ-PC",
  SYP: "SYP-PC",
};

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
  const workerName = workerNameForSite(site);

  const inFlight = await findInFlightPoSync(supabase, site);
  if (inFlight) {
    return { alreadyRunning: true, job: inFlight };
  }

  const heartbeat = await getWorkerHeartbeat(supabase, workerName);
  if (!isWorkerOnline(heartbeat?.last_seen ?? null)) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      workerName,
      lastSeen: heartbeat?.last_seen ?? null,
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
  supabase: SupabaseClient,
  site: PoSyncSite
): Promise<JobQueueRow | null> {
  const { data, error } = await supabase.rpc("fn_inventory_find_inflight_sync", {
    p_site: site,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapJob(row as Record<string, unknown>);
}

export async function enqueueInventorySyncSite(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  requestedBy: string;
}): Promise<JobQueueRow> {
  const { supabase, site, requestedBy } = params;
  const workerName = workerNameForSite(site);
  const { data, error } = await supabase.rpc("fn_inventory_enqueue_sync", {
    p_site: site,
    p_worker_name: workerName,
    p_requested_by: requestedBy,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Inventory enqueue returned no row");
  return mapJob(row as Record<string, unknown>);
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

  const inFlightBySite = await Promise.all(
    INVENTORY_SYNC_SITES.map(async (site) => ({
      site,
      job: await findInFlightInventorySync(supabase, site),
    }))
  );
  const running = inFlightBySite
    .map((x) => x.job)
    .filter((job): job is JobQueueRow => Boolean(job));
  if (running.length > 0) {
    return { alreadyRunning: true, jobs: running };
  }

  const heartbeats = await Promise.all(
    INVENTORY_SYNC_SITES.map(async (site) => {
      const workerName = workerNameForSite(site);
      const heartbeat = await getWorkerHeartbeat(supabase, workerName);
      return {
        site,
        workerName,
        lastSeen: heartbeat?.last_seen ?? null,
        online: isWorkerOnline(heartbeat?.last_seen ?? null),
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
  if (offlineWorkers.length > 0) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      offlineWorkers,
    };
  }

  const jobs: JobQueueRow[] = [];
  for (const site of INVENTORY_SYNC_SITES) {
    jobs.push(
      await enqueueInventorySyncSite({
        supabase,
        site,
        requestedBy,
      })
    );
  }

  return {
    alreadyRunning: false,
    workerOnline: true,
    jobs,
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
