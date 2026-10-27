import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ONLINE_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  briefFifoMargin,
  fifoMargin,
  fifoSiteForBillnos,
  saleBillTakesFifo,
  type FifoMarginBrief,
} from "@/lib/bank/fifo-margin";
import { loadSaleFifo } from "@/lib/bank/fifo-margin-query";
import {
  parseOnlinePayoutListQuery,
  payoutAtLowerBound,
  payoutAtUpperBound,
} from "@/lib/online-statements/list-query";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const permCheck = await requirePermission(ONLINE_STATEMENT_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const depositId = url.searchParams.get("deposit")?.trim() || "";
  const listQuery = parseOnlinePayoutListQuery(url.searchParams);
  const { platform, status } = listQuery;

  const supabase = createAdminClient();
  if (depositId) {
    const depositRes = await supabase
      .schema("curated_kcw")
      .from("online_bank_deposits")
      .select(
        "statement_line_id, platform, shop, bank_date, amount, period_from, period_to, payout_count"
      )
      .eq("statement_line_id", depositId)
      .maybeSingle();
    if (depositRes.error) {
      return NextResponse.json({ error: depositRes.error.message }, { status: 500 });
    }
    if (!depositRes.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const linkRes = await supabase
      .schema("curated_kcw")
      .from("online_bank_deposit_payouts")
      .select("payout_key")
      .eq("statement_line_id", depositId);
    if (linkRes.error) {
      return NextResponse.json({ error: linkRes.error.message }, { status: 500 });
    }
    const keys = (linkRes.data ?? []).map((row) => row.payout_key);
    const payoutRes = keys.length
      ? await supabase
          .schema("curated_kcw")
          .from("online_payouts")
          .select(
            "payout_key, platform, shop, payout_at, amount, currency, reference, status, source_file, note, order_count, expense_amount, component_net, matched_order_count, built_at"
          )
          .in("payout_key", keys)
          .order("payout_at", { ascending: true })
      : { data: [], error: null };
    if (payoutRes.error) {
      return NextResponse.json({ error: payoutRes.error.message }, { status: 500 });
    }
    const payouts = payoutRes.data ?? [];
    const billRes = keys.length
      ? await supabase
          .schema("curated_kcw")
          .from("online_order_bills")
          .select("payout_key, billno, canceled")
          .in("payout_key", keys)
      : { data: [], error: null };
    if (billRes.error) {
      return NextResponse.json({ error: billRes.error.message }, { status: 500 });
    }
    const saleBills = (billRes.data ?? []).filter(
      (bill) => !bill.canceled && saleBillTakesFifo(String(bill.billno ?? ""))
    );
    const saleBillnos = saleBills.map((bill) => String(bill.billno ?? ""));
    let fifoError: string | null = null;
    let costs: Awaited<ReturnType<typeof loadSaleFifo>> = [];
    try {
      costs = await loadSaleFifo(saleBillnos, fifoSiteForBillnos(saleBillnos));
    } catch (err: unknown) {
      fifoError = err instanceof Error ? err.message : "โหลดต้นทุน FIFO ไม่สำเร็จ";
    }
    const billnosByPayout = new Map<string, string[]>();
    for (const bill of billRes.data ?? []) {
      const key = String(bill.payout_key ?? "");
      const list = billnosByPayout.get(key) ?? [];
      const billno = String(bill.billno ?? "").trim();
      if (billno) list.push(billno);
      billnosByPayout.set(key, list);
    }
    const payoutsWithBills = payouts.map((payout) => ({
      ...payout,
      billnos: billnosByPayout.get(payout.payout_key) ?? [],
    }));
    if (fifoError) {
      return NextResponse.json({
        deposit: depositRes.data,
        payouts: payoutsWithBills,
        deposit_fifo: null,
        fifo_error: fifoError,
      });
    }
    const billsByPayout = new Map<string, string[]>();
    for (const bill of saleBills) {
      const key = String(bill.payout_key ?? "");
      const list = billsByPayout.get(key) ?? [];
      list.push(String(bill.billno ?? ""));
      billsByPayout.set(key, list);
    }
    const withFifo = payoutsWithBills.map((payout) => {
      const billnos = billsByPayout.get(payout.payout_key) ?? [];
      const fifo: FifoMarginBrief | null =
        billnos.length === 0
          ? null
          : briefFifoMargin(
              fifoMargin({
                revenue: Number(payout.amount ?? 0),
                billnos,
                costs,
              })
            );
      return { ...payout, fifo };
    });
    const depositFifo =
      saleBillnos.length === 0
        ? null
        : briefFifoMargin(
            fifoMargin({
              revenue: Number(depositRes.data.amount ?? 0),
              billnos: saleBillnos,
              costs,
            })
          );
    return NextResponse.json({
      deposit: depositRes.data,
      payouts: withFifo,
      deposit_fifo: depositFifo,
      fifo_error: fifoError,
    });
  }

  let query = supabase
    .schema("curated_kcw")
    .from("online_payouts")
    .select(
      "payout_key, platform, shop, payout_at, amount, currency, reference, status, source_file, note, order_count, expense_amount, component_net, matched_order_count, built_at"
    );

  if (platform && platform !== "all") query = query.eq("platform", platform);
  if (status && status !== "all") query = query.eq("status", status);
  if (listQuery.shop) query = query.eq("shop", listQuery.shop);
  if (listQuery.from) query = query.gte("payout_at", payoutAtLowerBound(listQuery.from));
  if (listQuery.to) query = query.lt("payout_at", payoutAtUpperBound(listQuery.to));

  const { data, error } = await query
    .order(listQuery.sort, { ascending: listQuery.ascending, nullsFirst: false })
    .limit(listQuery.limit + 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const truncated = rows.length > listQuery.limit;
  return NextResponse.json({
    payouts: truncated ? rows.slice(0, listQuery.limit) : rows,
    truncated,
  });
}
