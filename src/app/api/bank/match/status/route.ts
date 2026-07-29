import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  getCursorAgentRun,
  isCursorRunTerminal,
} from "@/lib/bank/cursor-agents";
import {
  getBankMatchAgentJob,
  publicBankMatchAgentJob,
  releaseBankMatchAgentJob,
  updateBankMatchAgentRunStatus,
} from "@/lib/bank/match-agent-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const supabase = createAdminClient();
    const job = await getBankMatchAgentJob(supabase);
    if (!job) {
      return NextResponse.json({ active: false });
    }

    if (!job.agentId || !job.runId) {
      return NextResponse.json({
        active: true,
        job: publicBankMatchAgentJob(job),
        run: null,
      });
    }

    const run = await getCursorAgentRun({
      agentId: job.agentId,
      runId: job.runId,
    });
    const terminal = isCursorRunTerminal(run.status);

    if (terminal) {
      await releaseBankMatchAgentJob({
        supabase,
        lockToken: job.lockToken,
      });
    } else {
      await updateBankMatchAgentRunStatus({
        supabase,
        lockToken: job.lockToken,
        run,
      });
    }

    return NextResponse.json({
      active: !terminal,
      job: publicBankMatchAgentJob({ ...job, runStatus: run.status }),
      run,
      terminal,
      agentUrl: `https://cursor.com/agents/${run.agentId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Missing CURSOR_API_KEY") ? 503 : 500;
    console.error("bank match status", error);
    return NextResponse.json(
      {
        error:
          status === 503
            ? "ยังไม่ได้ตั้ง CURSOR_API_KEY ในเซิร์ฟเวอร์"
            : "ไม่สามารถเช็คสถานะ agent ได้",
        details: message,
      },
      { status }
    );
  }
}
