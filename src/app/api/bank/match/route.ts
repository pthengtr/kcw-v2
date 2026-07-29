import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  getCursorAgentRun,
  isCursorRunTerminal,
  launchCursorCloudAgent,
  resolveCursorAgentModel,
} from "@/lib/bank/cursor-agents";
import {
  publicBankMatchAgentJob,
  releaseBankMatchAgentJob,
  markBankMatchAgentRunning,
  tryAcquireBankMatchAgentJob,
  type BankMatchAgentJob,
} from "@/lib/bank/match-agent-jobs";
import {
  BANK_MATCH_AGENT_NAME,
  bankMatchAccountsLabel,
  buildBankMatchPrompt,
  isBankMatchAccount,
} from "@/lib/bank/match-prompt";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  account_no: z.string().trim().min(1),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function acquireAvailableSlot(params: {
  requestedBy: string;
  accountNo: string;
  from: string;
  to: string;
}): Promise<
  | { acquired: true; job: BankMatchAgentJob }
  | { acquired: false; job: BankMatchAgentJob }
> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const claim = await tryAcquireBankMatchAgentJob({
      supabase,
      requestedBy: params.requestedBy,
      accountNo: params.accountNo,
      from: params.from,
      to: params.to,
    });
    if (claim.acquired) return claim;

    const active = claim.job;
    if (!active.agentId || !active.runId) {
      return claim;
    }

    try {
      const run = await getCursorAgentRun({
        agentId: active.agentId,
        runId: active.runId,
      });
      if (!isCursorRunTerminal(run.status)) {
        return {
          acquired: false,
          job: { ...active, runStatus: run.status },
        };
      }
      await releaseBankMatchAgentJob({
        supabase,
        lockToken: active.lockToken,
      });
    } catch (error) {
      // Fail closed: an unavailable Cursor status API must not allow a duplicate.
      console.error("bank match active run check", error);
      return claim;
    }
  }

  throw new Error("Unable to acquire the bank match agent slot");
}

export async function POST(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { account_no, from, to } = parsed.data;
  if (!isBankMatchAccount(account_no)) {
    return NextResponse.json(
      {
        error: `จับคู่ยอดเข้า รองรับเฉพาะบัญชี ${bankMatchAccountsLabel()}`,
        account_no,
      },
      { status: 400 }
    );
  }

  if (from > to) {
    return NextResponse.json(
      { error: "`from` must be on or before `to`" },
      { status: 400 }
    );
  }

  let claimedJob: BankMatchAgentJob | null = null;
  let agentLaunched = false;
  try {
    const claim = await acquireAvailableSlot({
      requestedBy: permCheck.userId,
      accountNo: account_no,
      from,
      to,
    });
    if (!claim.acquired) {
      return NextResponse.json(
        {
          error: "มี agent จับคู่รายการเดินบัญชีกำลังทำงานอยู่",
          alreadyRunning: true,
          activeJob: publicBankMatchAgentJob(claim.job),
        },
        { status: 409 }
      );
    }
    claimedJob = claim.job;

    const promptText = buildBankMatchPrompt({ account_no, from, to });
    const model = resolveCursorAgentModel();
    const launched = await launchCursorCloudAgent({
      promptText,
      name: `${BANK_MATCH_AGENT_NAME} ${account_no} ${from}..${to}`,
      model,
    });
    agentLaunched = true;
    const activeJob = await markBankMatchAgentRunning({
      supabase: createAdminClient(),
      lockToken: claimedJob.lockToken,
      launched,
    });

    return NextResponse.json({
      ok: true,
      message: `เริ่ม${BANK_MATCH_AGENT_NAME}แล้ว สำหรับบัญชี ${account_no}`,
      account_no,
      from,
      to,
      model: launched.model,
      usedModelFallback: launched.usedModelFallback ?? false,
      agent: launched,
      activeJob: publicBankMatchAgentJob(activeJob),
    });
  } catch (error) {
    if (claimedJob && !agentLaunched) {
      await releaseBankMatchAgentJob({
        supabase: createAdminClient(),
        lockToken: claimedJob.lockToken,
      }).catch((releaseError) => {
        console.error("bank match lock release", releaseError);
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Missing CURSOR_API_KEY") ? 503 : 500;
    console.error("bank match launch", error);
    return NextResponse.json(
      {
        error:
          status === 503
            ? "ยังไม่ได้ตั้ง CURSOR_API_KEY ในเซิร์ฟเวอร์"
            : "ไม่สามารถเริ่มงานจับคู่ได้",
        details: message,
      },
      { status }
    );
  }
}
