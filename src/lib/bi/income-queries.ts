import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiIncomeBlankCostLine,
  BiIncomeBlankCosts,
  BiIncomeBranchRow,
  BiIncomeOpexCategoryRow,
  BiIncomeOverview,
  BiIncomeTrendRow,
} from "./income-types";

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function parseBranchRows(value: unknown): BiIncomeBranchRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      revenue_net: asNumber(r.revenue_net),
      cogs: asNumber(r.cogs),
      gross_profit: asNumber(r.gross_profit),
      opex: asNumber(r.opex),
      net_income: asNumber(r.net_income),
      bill_count: asNumber(r.bill_count),
    };
  });
}

function parseOpexCategoryRows(value: unknown): BiIncomeOpexCategoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label),
      amount: asNumber(r.amount),
    };
  });
}

function parseTrendRows(value: unknown): BiIncomeTrendRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      period: asString(r.period),
      revenue_net: asNumber(r.revenue_net),
      cogs: asNumber(r.cogs),
      gross_profit: asNumber(r.gross_profit),
      opex: asNumber(r.opex),
      net_income: asNumber(r.net_income),
    };
  });
}

export function normalizeIncomeOverview(raw: unknown): BiIncomeOverview {
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
      cogs: asNumber(summary.cogs),
      gross_profit: asNumber(summary.gross_profit),
      gross_margin_pct: asNullableNumber(summary.gross_margin_pct),
      opex: asNumber(summary.opex),
      net_income: asNumber(summary.net_income),
      net_margin_pct: asNullableNumber(summary.net_margin_pct),
      bill_count: asNumber(summary.bill_count),
      line_count: asNumber(summary.line_count),
      blank_cost_line_count: asNumber(summary.blank_cost_line_count),
    },
    previous_summary: {
      revenue_net: asNumber(previous.revenue_net),
      cogs: asNumber(previous.cogs),
      gross_profit: asNumber(previous.gross_profit),
      gross_margin_pct: asNullableNumber(previous.gross_margin_pct),
      opex: asNumber(previous.opex),
      net_income: asNumber(previous.net_income),
      net_margin_pct: asNullableNumber(previous.net_margin_pct),
    },
    by_branch: parseBranchRows(data.by_branch),
    opex_by_category: parseOpexCategoryRows(data.opex_by_category),
    trend_daily: parseTrendRows(data.trend_daily),
    trend_monthly: parseTrendRows(data.trend_monthly),
  };
}

export async function fetchIncomeOverview(
  supabase: SupabaseClient,
  params: { from: string; to: string; branch?: string | null }
): Promise<BiIncomeOverview> {
  const { data, error } = await supabase.rpc("fn_bi_income_overview", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
  });

  if (error) {
    throw new Error(error.message || "Unable to load income overview");
  }

  return normalizeIncomeOverview(data);
}

function parseBlankCostLines(value: unknown): BiIncomeBlankCostLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      bill_date: asString(r.bill_date),
      store_branch: asString(r.store_branch),
      reporting_branch: asString(r.reporting_branch),
      bill_no: asString(r.bill_no),
      bcode: asString(r.bcode),
      detail: asString(r.detail),
      qty: asNumber(r.qty),
      mtp: asNumber(r.mtp),
      amount_gross: asNumber(r.amount_gross),
      cost_status: asString(r.cost_status),
    };
  });
}

export function normalizeIncomeBlankCosts(raw: unknown): BiIncomeBlankCosts {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    limit: asNumber(data.limit),
    total_count: asNumber(data.total_count),
    returned_count: asNumber(data.returned_count),
    truncated: Boolean(data.truncated),
    lines: parseBlankCostLines(data.lines),
  };
}

export async function fetchIncomeBlankCosts(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    branch?: string | null;
    limit?: number;
  }
): Promise<BiIncomeBlankCosts> {
  const { data, error } = await supabase.rpc("fn_bi_income_blank_costs", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
    p_limit: params.limit ?? 500,
  });

  if (error) {
    throw new Error(error.message || "Unable to load blank cost lines");
  }

  return normalizeIncomeBlankCosts(data);
}
