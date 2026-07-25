import type { SupabaseClient } from "@supabase/supabase-js";

import type { BiSalesOverview, BiSplitRow, BiTrendRow } from "./sales-types";

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function parseSplitRows(value: unknown): BiSplitRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      revenue_net: asNumber(r.revenue_net),
      bill_count: asNumber(r.bill_count),
    };
  });
}

function parseTrendRows(value: unknown): BiTrendRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      period: asString(r.period),
      revenue_net: asNumber(r.revenue_net),
      bill_count: asNumber(r.bill_count),
      hq_revenue_net: asNumber(r.hq_revenue_net),
      syp_revenue_net: asNumber(r.syp_revenue_net),
      online_revenue_net: asNumber(r.online_revenue_net),
    };
  });
}

export function normalizeSalesOverview(raw: unknown): BiSalesOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;

  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    summary: {
      revenue_net: asNumber(summary.revenue_net),
      vat_baht: asNumber(summary.vat_baht),
      bill_count: asNumber(summary.bill_count),
      avg_bill: asNumber(summary.avg_bill),
    },
    previous_summary: {
      revenue_net: asNumber(previous.revenue_net),
      vat_baht: asNumber(previous.vat_baht),
      bill_count: asNumber(previous.bill_count),
    },
    by_sales_type: parseSplitRows(data.by_sales_type),
    by_branch: parseSplitRows(data.by_branch),
    by_channel: parseSplitRows(data.by_channel),
    by_billtype: parseSplitRows(data.by_billtype),
    trend_daily: parseTrendRows(data.trend_daily),
    trend_monthly: parseTrendRows(data.trend_monthly),
  };
}

export async function fetchSalesOverview(
  supabase: SupabaseClient,
  params: { from: string; to: string; branch?: string | null }
): Promise<BiSalesOverview> {
  const { data, error } = await supabase.rpc("fn_bi_sales_overview", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
  });

  if (error) {
    throw new Error(error.message || "Unable to load sales overview");
  }

  return normalizeSalesOverview(data);
}
