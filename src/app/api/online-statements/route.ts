import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.onlineStatements);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "transferred";

  const supabase = createAdminClient();
  let query = supabase
    .schema("curated_kcw")
    .from("online_payouts")
    .select(
      "payout_key, platform, shop, payout_at, amount, currency, reference, status, source_file, note, order_count, expense_amount, component_net, matched_order_count, built_at"
    )
    .order("payout_at", { ascending: false })
    .limit(500);

  if (platform && platform !== "all") query = query.eq("platform", platform);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payouts: data ?? [] });
}
