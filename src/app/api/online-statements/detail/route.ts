import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ONLINE_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fifoSiteForBillnos, saleBillTakesFifo } from "@/lib/bank/fifo-margin";
import { loadSaleFifo } from "@/lib/bank/fifo-margin-query";
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

  const bills = billRes.data ?? [];
  const saleBillnos = bills
    .filter((bill) => !bill.canceled && saleBillTakesFifo(String(bill.billno ?? "")))
    .map((bill) => String(bill.billno ?? ""));
  let fifo: Awaited<ReturnType<typeof loadSaleFifo>> = [];
  let fifoError: string | null = null;
  try {
    fifo = await loadSaleFifo(saleBillnos, fifoSiteForBillnos(saleBillnos));
  } catch (err: unknown) {
    fifoError = err instanceof Error ? err.message : "โหลดต้นทุน FIFO ไม่สำเร็จ";
  }

  return NextResponse.json({
    payout: payoutRes.data,
    lines: lineRes.data ?? [],
    bills,
    fifo,
    fifo_error: fifoError,
  });
}
