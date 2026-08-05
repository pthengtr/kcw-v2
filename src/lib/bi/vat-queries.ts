import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiVatBranchRow,
  BiVatDocRow,
  BiVatForecast,
  BiVatOverview,
  BiVatSummary,
  BiVatTrendRow,
} from "./vat-types";

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

function asBool(value: unknown): boolean {
  return value === true;
}

function parseSummary(value: unknown): BiVatSummary {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    sales_before: asNumber(r.sales_before),
    sales_vat: asNumber(r.sales_vat),
    sales_bill_count: asNumber(r.sales_bill_count),
    purchase_before: asNumber(r.purchase_before),
    purchase_vat: asNumber(r.purchase_vat),
    purchase_bill_count: asNumber(r.purchase_bill_count),
    expense_before: asNumber(r.expense_before),
    expense_vat: asNumber(r.expense_vat),
    expense_bill_count: asNumber(r.expense_bill_count),
    net_vat: asNumber(r.net_vat),
  };
}

function parseForecast(value: unknown): BiVatForecast {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    enabled: asBool(r.enabled),
    as_of: asString(r.as_of),
    days_elapsed: asNumber(r.days_elapsed),
    days_in_range: asNumber(r.days_in_range),
    factor: asNumber(r.factor) || 1,
    sales_vat: asNumber(r.sales_vat),
    purchase_vat: asNumber(r.purchase_vat),
    expense_vat: asNumber(r.expense_vat),
    net_vat: asNumber(r.net_vat),
    sales_before: asNumber(r.sales_before),
    purchase_before: asNumber(r.purchase_before),
    expense_before: asNumber(r.expense_before),
  };
}

function parseDocRows(value: unknown): BiVatDocRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      branch: r.branch == null ? undefined : asString(r.branch),
      bill_count: asNumber(r.bill_count),
      beforetax: asNumber(r.beforetax),
      tax: asNumber(r.tax),
      aftertax: asNumber(r.aftertax),
    };
  });
}

function parseBranchRows(value: unknown): BiVatBranchRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      sales_vat: asNumber(r.sales_vat),
      sales_before: asNumber(r.sales_before),
      purchase_vat: asNumber(r.purchase_vat),
      purchase_before: asNumber(r.purchase_before),
      expense_vat: asNumber(r.expense_vat),
      expense_before: asNumber(r.expense_before),
      net_vat: asNumber(r.net_vat),
    };
  });
}

function parseTrendRows(value: unknown): BiVatTrendRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      period: asString(r.period),
      sales_vat: asNumber(r.sales_vat),
      purchase_vat: asNumber(r.purchase_vat),
      expense_vat: asNumber(r.expense_vat),
      net_vat: asNumber(r.net_vat),
    };
  });
}

export function normalizeVatOverview(raw: unknown): BiVatOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    as_of: asString(data.as_of),
    summary: parseSummary(data.summary),
    previous_summary: parseSummary(data.previous_summary),
    forecast: parseForecast(data.forecast),
    by_sales_doc: parseDocRows(data.by_sales_doc),
    by_purchase_book: parseDocRows(data.by_purchase_book),
    by_expense_doc: parseDocRows(data.by_expense_doc),
    by_branch: parseBranchRows(data.by_branch),
    trend_daily: parseTrendRows(data.trend_daily),
    trend_monthly: parseTrendRows(data.trend_monthly),
  };
}

export async function fetchVatOverview(
  supabase: SupabaseClient,
  params: { from: string; to: string; branch?: string | null }
): Promise<BiVatOverview> {
  const { data, error } = await supabase.rpc("fn_bi_vat_overview", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
  });

  if (error) {
    throw new Error(error.message || "Unable to load VAT overview");
  }

  return normalizeVatOverview(data);
}
