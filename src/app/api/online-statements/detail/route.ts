import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ONLINE_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const permCheck = await requirePermission(ONLINE_STATEMENT_READ_PAGE_KEYS);
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

  const orderIds = [
    ...new Set(
      (lineRes.data ?? [])
        .map((line) => String(line.order_id ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const receipts = [];
  for (let i = 0; i < orderIds.length; i += 80) {
    const chunk = orderIds.slice(i, i + 80);
    const receiptRes = await schema
      .from("online_peak_receipts")
      .select(
        "platform, order_id, receipt_no, receipt_date, receipt_status, receipt_amount, order_status, order_amount, shop_name"
      )
      .eq("platform", payoutRes.data.platform)
      .in("order_id", chunk);
    if (receiptRes.error) {
      return NextResponse.json({ error: receiptRes.error.message }, { status: 500 });
    }
    receipts.push(...(receiptRes.data ?? []));
  }

  return NextResponse.json({
    payout: payoutRes.data,
    lines: lineRes.data ?? [],
    bills: billRes.data ?? [],
    receipts,
  });
}
