import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CursorAgentLaunchResult,
  CursorAgentRunStatus,
} from "@/lib/bank/cursor-agents";

const GLOBAL_LOCK_KEY = "global";

export type BankMatchAgentJob = {
  lockToken: string;
  state: "launching" | "running";
  accountNo: string;
  from: string;
  to: string;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  agentId: string | null;
  runId: string | null;
  agentUrl: string | null;
  runStatus: string | null;
};

export type PublicBankMatchAgentJob = Omit<
  BankMatchAgentJob,
  "lockToken" | "requestedBy"
>;

type LockRow = {
  lock_token: string;
  state: "launching" | "running";
  account_no: string;
  date_from: string;
  date_to: string;
  requested_by: string;
  requested_at: string;
  updated_at: string;
  agent_id: string | null;
  run_id: string | null;
  agent_url: string | null;
  run_status: string | null;
};

function mapLockRow(row: LockRow): BankMatchAgentJob {
  return {
    lockToken: row.lock_token,
    state: row.state,
    accountNo: row.account_no,
    from: row.date_from,
    to: row.date_to,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
    agentId: row.agent_id,
    runId: row.run_id,
    agentUrl: row.agent_url,
    runStatus: row.run_status,
  };
}

export function publicBankMatchAgentJob(
  job: BankMatchAgentJob
): PublicBankMatchAgentJob {
  return {
    state: job.state,
    accountNo: job.accountNo,
    from: job.from,
    to: job.to,
    requestedAt: job.requestedAt,
    updatedAt: job.updatedAt,
    agentId: job.agentId,
    runId: job.runId,
    agentUrl: job.agentUrl,
    runStatus: job.runStatus,
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function getBankMatchAgentJob(
  supabase: SupabaseClient
): Promise<BankMatchAgentJob | null> {
  const { data, error } = await supabase
    .from("bank_match_agent_locks")
    .select("*")
    .eq("lock_key", GLOBAL_LOCK_KEY)
    .maybeSingle();
  if (error) throw error;
  return data ? mapLockRow(data as LockRow) : null;
}

export async function tryAcquireBankMatchAgentJob(params: {
  supabase: SupabaseClient;
  requestedBy: string;
  accountNo: string;
  from: string;
  to: string;
}): Promise<
  | { acquired: true; job: BankMatchAgentJob }
  | { acquired: false; job: BankMatchAgentJob }
> {
  const lockToken = crypto.randomUUID();
  const { data, error } = await params.supabase
    .from("bank_match_agent_locks")
    .insert({
      lock_key: GLOBAL_LOCK_KEY,
      lock_token: lockToken,
      state: "launching",
      account_no: params.accountNo,
      date_from: params.from,
      date_to: params.to,
      requested_by: params.requestedBy,
    })
    .select("*")
    .single();

  if (!error && data) {
    return { acquired: true, job: mapLockRow(data as LockRow) };
  }
  if (!isUniqueViolation(error)) {
    throw error ?? new Error("Unable to acquire bank match agent lock");
  }

  const existing = await getBankMatchAgentJob(params.supabase);
  if (!existing) {
    throw new Error("Bank match agent lock changed while acquiring it");
  }
  return { acquired: false, job: existing };
}

export async function markBankMatchAgentRunning(params: {
  supabase: SupabaseClient;
  lockToken: string;
  launched: CursorAgentLaunchResult;
}): Promise<BankMatchAgentJob> {
  const { data, error } = await params.supabase
    .from("bank_match_agent_locks")
    .update({
      state: "running",
      agent_id: params.launched.agentId,
      run_id: params.launched.runId,
      agent_url: params.launched.agentUrl,
      run_status: params.launched.status,
      updated_at: new Date().toISOString(),
    })
    .eq("lock_key", GLOBAL_LOCK_KEY)
    .eq("lock_token", params.lockToken)
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Bank match agent lock disappeared after launch");
  return mapLockRow(data as LockRow);
}

export async function updateBankMatchAgentRunStatus(params: {
  supabase: SupabaseClient;
  lockToken: string;
  run: CursorAgentRunStatus;
}): Promise<void> {
  const { error } = await params.supabase
    .from("bank_match_agent_locks")
    .update({
      run_status: params.run.status,
      updated_at: new Date().toISOString(),
    })
    .eq("lock_key", GLOBAL_LOCK_KEY)
    .eq("lock_token", params.lockToken);
  if (error) throw error;
}

export async function releaseBankMatchAgentJob(params: {
  supabase: SupabaseClient;
  lockToken: string;
}): Promise<void> {
  const { error } = await params.supabase
    .from("bank_match_agent_locks")
    .delete()
    .eq("lock_key", GLOBAL_LOCK_KEY)
    .eq("lock_token", params.lockToken);
  if (error) throw error;
}
