import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ONLINE_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
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
    return NextResponse.json({
      deposit: depositRes.data,
      payouts: payoutRes.data ?? [],
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
