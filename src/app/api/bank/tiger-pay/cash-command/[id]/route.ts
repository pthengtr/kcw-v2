import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCashCommand } from "@/lib/bank/tiger-pay-queries";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.tigerPay);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const command = await getCashCommand(supabase, id);
    if (!command) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ command });
  } catch (error) {
    console.error("tiger-pay cash-command get", error);
    return NextResponse.json(
      { error: "Unable to load hopper command" },
      { status: 500 }
    );
  }
}
