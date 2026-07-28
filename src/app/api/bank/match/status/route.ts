import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  getCursorAgentRun,
  isCursorRunTerminal,
} from "@/lib/bank/cursor-agents";

const QuerySchema = z.object({
  agentId: z.string().trim().min(1),
  runId: z.string().trim().min(1),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    agentId: url.searchParams.get("agentId") ?? "",
    runId: url.searchParams.get("runId") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const run = await getCursorAgentRun(parsed.data);
    return NextResponse.json({
      run,
      terminal: isCursorRunTerminal(run.status),
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
