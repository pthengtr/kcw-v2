import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { launchCursorCloudAgent } from "@/lib/bank/cursor-agents";
import {
  BANK_MATCH_AGENT_NAME,
  bankMatchAccountsLabel,
  buildBankMatchPrompt,
  isBankMatchAccount,
} from "@/lib/bank/match-prompt";

const BodySchema = z.object({
  account_no: z.string().trim().min(1),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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

  try {
    const promptText = buildBankMatchPrompt({ account_no, from, to });
    const launched = await launchCursorCloudAgent({
      promptText,
      name: `${BANK_MATCH_AGENT_NAME} ${account_no} ${from}..${to}`,
    });

    return NextResponse.json({
      ok: true,
      message: `เริ่ม${BANK_MATCH_AGENT_NAME}แล้ว สำหรับบัญชี ${account_no}`,
      account_no,
      from,
      to,
      agent: launched,
    });
  } catch (error) {
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
