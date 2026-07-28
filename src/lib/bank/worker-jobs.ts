import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getJobById,
  getWorkerHeartbeat,
  isWorkerOnline,
  type JobQueueRow,
  type WorkerHeartbeatRow,
} from "@/lib/po/worker-jobs";

export { getJobById, isWorkerOnline };
export type { JobQueueRow, WorkerHeartbeatRow };

export const BANK_IMPORT_JOB_TYPE = "bank_statement_import";
export const BANK_WORKER_CANDIDATES = ["HQ-PC", "SYP-PC"] as const;

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

export async function findInFlightBankImport(
  supabase: SupabaseClient
): Promise<JobQueueRow | null> {
  const { data, error } = await supabase.rpc("fn_bank_find_inflight_import");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapJob(row as Record<string, unknown>);
}

export async function getAnyOnlineBankWorker(
  supabase: SupabaseClient
): Promise<{
  online: boolean;
  workers: Array<{
    workerName: string;
    online: boolean;
    lastSeen: string | null;
    status: string | null;
  }>;
}> {
  const workers = await Promise.all(
    BANK_WORKER_CANDIDATES.map(async (workerName) => {
      const heartbeat = await getWorkerHeartbeat(supabase, workerName);
      return {
        workerName,
        online: isWorkerOnline(heartbeat?.last_seen ?? null),
        lastSeen: heartbeat?.last_seen ?? null,
        status: heartbeat?.status ?? null,
      };
    })
  );
  return {
    online: workers.some((w) => w.online),
    workers,
  };
}

export async function enqueueBankImport(params: {
  supabase: SupabaseClient;
  requestedBy: string;
}): Promise<
  | { alreadyRunning: true; job: JobQueueRow }
  | { alreadyRunning: false; job: JobQueueRow; workerOnline: true }
  | {
      alreadyRunning: false;
      workerOnline: false;
      workers: Array<{
        workerName: string;
        online: boolean;
        lastSeen: string | null;
        status: string | null;
      }>;
    }
> {
  const { supabase, requestedBy } = params;

  const inFlight = await findInFlightBankImport(supabase);
  if (inFlight) {
    return { alreadyRunning: true, job: inFlight };
  }

  const availability = await getAnyOnlineBankWorker(supabase);
  if (!availability.online) {
    return {
      alreadyRunning: false,
      workerOnline: false,
      workers: availability.workers,
    };
  }

  const { data, error } = await supabase.rpc("fn_bank_enqueue_import", {
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

export async function fetchBankSyncMeta(supabase: SupabaseClient) {
  const [availability, inFlightJob] = await Promise.all([
    getAnyOnlineBankWorker(supabase),
    findInFlightBankImport(supabase),
  ]);
  return {
    workerOnline: availability.online,
    workers: availability.workers,
    inFlightJob,
  };
}
