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

  const payoutKey = new URL(req.url).searchParams.get("payout")?.trim() || "";
  if (!payoutKey) {
    return NextResponse.json({ error: "Missing payout" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const schema = supabase.schema("curated_kcw");
  const [payoutRes, lineRes, billRes] = await Promise.all([
    schema.from("online_payouts").select("*").eq("payout_key", payoutKey).maybeSingle(),
    schema
      .from("online_payout_lines")
      .select("*")
      .eq("payout_key", payoutKey)
      .order("line_no", { ascending: true }),
    schema
      .from("online_order_bills")
      .select("*")
      .eq("payout_key", payoutKey)
      .order("billno", { ascending: true }),
  ]);

  const error = payoutRes.error || lineRes.error || billRes.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!payoutRes.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    payout: payoutRes.data,
    lines: lineRes.data ?? [],
    bills: billRes.data ?? [],
  });
}
