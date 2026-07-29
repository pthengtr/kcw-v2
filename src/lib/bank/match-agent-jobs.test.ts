import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isUniqueViolation,
  publicBankMatchAgentJob,
  tryAcquireBankMatchAgentJob,
} from "@/lib/bank/match-agent-jobs";

const lockRow = {
  lock_token: "e72f6491-ea93-43af-a25d-60445ed0f4ce",
  state: "running" as const,
  account_no: "1234567890",
  date_from: "2026-07-01",
  date_to: "2026-07-31",
  requested_by: "04d0f2fd-4814-4d3b-b66f-851a7ed26e97",
  requested_at: "2026-07-29T08:00:00.000Z",
  updated_at: "2026-07-29T08:01:00.000Z",
  agent_id: "bc_agent",
  run_id: "run_1",
  agent_url: "https://cursor.com/agents/bc_agent",
  run_status: "RUNNING",
};

function fakeSupabase(params: {
  insertResult: { data: unknown; error: unknown };
  existingResult?: { data: unknown; error: unknown };
}): SupabaseClient {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => params.insertResult,
        }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            params.existingResult ?? { data: null, error: null },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("bank match agent lock", () => {
  it("recognizes Postgres unique conflicts", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("returns the existing global job when another request owns the lock", async () => {
    const result = await tryAcquireBankMatchAgentJob({
      supabase: fakeSupabase({
        insertResult: { data: null, error: { code: "23505" } },
        existingResult: { data: lockRow, error: null },
      }),
      requestedBy: "another-user",
      accountNo: "1234567890",
      from: "2026-07-01",
      to: "2026-07-31",
    });

    expect(result).toEqual({
      acquired: false,
      job: {
        lockToken: lockRow.lock_token,
        state: "running",
        accountNo: lockRow.account_no,
        from: lockRow.date_from,
        to: lockRow.date_to,
        requestedBy: lockRow.requested_by,
        requestedAt: lockRow.requested_at,
        updatedAt: lockRow.updated_at,
        agentId: lockRow.agent_id,
        runId: lockRow.run_id,
        agentUrl: lockRow.agent_url,
        runStatus: lockRow.run_status,
      },
    });
  });

  it("does not expose lock ownership secrets to browsers", () => {
    const publicJob = publicBankMatchAgentJob({
      lockToken: lockRow.lock_token,
      state: lockRow.state,
      accountNo: lockRow.account_no,
      from: lockRow.date_from,
      to: lockRow.date_to,
      requestedBy: lockRow.requested_by,
      requestedAt: lockRow.requested_at,
      updatedAt: lockRow.updated_at,
      agentId: lockRow.agent_id,
      runId: lockRow.run_id,
      agentUrl: lockRow.agent_url,
      runStatus: lockRow.run_status,
    });

    expect(publicJob).not.toHaveProperty("lockToken");
    expect(publicJob).not.toHaveProperty("requestedBy");
    expect(publicJob.runId).toBe("run_1");
  });
});
