import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestCashSnapshot } from "@/lib/bank/tiger-pay-queries";

const QuerySchema = z.object({
  shop: z.string().trim().min(1).max(32).default("1"),
});

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.tigerPay);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    shop: url.searchParams.get("shop") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const hopper = await getLatestCashSnapshot(supabase, parsed.data.shop);
    return NextResponse.json({ hopper });
  } catch (error) {
    console.error("tiger-pay hopper", error);
    return NextResponse.json(
      { error: "Unable to load hopper snapshot" },
      { status: 500 }
    );
  }
}
