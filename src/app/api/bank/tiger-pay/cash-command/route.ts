import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertCashCommand } from "@/lib/bank/tiger-pay-queries";

const BodySchema = z.object({
  command: z.enum(["refresh", "close"]),
  shop: z.string().trim().min(1).max(32).default("1"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.tigerPay);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const command = await insertCashCommand(supabase, {
      command: parsed.data.command,
      shopCode: parsed.data.shop,
      date: parsed.data.date,
      requestedBy: permCheck.userEmail,
    });
    return NextResponse.json({ command });
  } catch (error) {
    console.error("tiger-pay cash-command", error);
    return NextResponse.json(
      { error: "Unable to queue hopper command" },
      { status: 500 }
    );
  }
}
