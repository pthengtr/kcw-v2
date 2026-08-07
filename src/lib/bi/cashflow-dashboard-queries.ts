import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiCashflowBalanceTrend,
  BiCashflowBankReconAccount,
  BiCashflowBankReconciliation,
  BiCashflowDashboard,
  BiCashflowDrilldown,
  BiCashflowDrilldownLine,
  BiCashflowMonthMovement,
  BiCashflowOperatingBreakdown,
  BiCashflowStatementRow,
  BiCashflowStatementRowKind,
} from "./cashflow-dashboard-types";

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

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = asString(value).trim();
  return s ? s : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseMonthMap(value: unknown): Record<string, number | null> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = asNullableNumber(v);
  }
  return out;
}

function parseStatementRows(value: unknown): BiCashflowStatementRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const kind = asString(r.kind) as BiCashflowStatementRowKind;
    return {
      key: asString(r.key),
      kind: [
        "section",
        "line",
        "subtotal",
        "total",
        "balance",
      ].includes(kind)
        ? kind
        : "line",
      code: asNullableString(r.code) ?? undefined,
      label: asString(r.label),
      label_th: asString(r.label_th) || asString(r.label),
      sign: r.sign == null ? undefined : asNumber(r.sign),
      months: r.months == null ? undefined : parseMonthMap(r.months),
      ytd: r.ytd === undefined ? undefined : asNullableNumber(r.ytd),
    };
  });
}

function parseMovement(value: unknown): BiCashflowMonthMovement[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      month: asNumber(r.month),
      period: asString(r.period),
      has_data: asBoolean(r.has_data),
      cash_in: asNullableNumber(r.cash_in),
      cash_out: asNullableNumber(r.cash_out),
      net_change: asNullableNumber(r.net_change),
    };
  });
}

function parseBalance(value: unknown): BiCashflowBalanceTrend[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      month: asNumber(r.month),
      period: asString(r.period),
      has_data: asBoolean(r.has_data),
      opening_cash: asNullableNumber(r.opening_cash),
      ending_cash: asNullableNumber(r.ending_cash),
    };
  });
}

function parseBreakdown(value: unknown): BiCashflowOperatingBreakdown[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label),
      label_th: asString(r.label_th) || asString(r.label),
      amount: asNumber(r.amount),
      share_of_sales: asNullableNumber(r.share_of_sales),
    };
  });
}

function parseReconAccounts(value: unknown): BiCashflowBankReconAccount[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      account_code: asString(r.account_code),
      account_name: asString(r.account_name),
      opening_balance: asNumber(r.opening_balance),
      cash_in: asNumber(r.cash_in),
      cash_out: asNumber(r.cash_out),
      calculated_closing: asNumber(r.calculated_closing),
      actual_balance: asNumber(r.actual_balance),
      variance: asNumber(r.variance),
    };
  });
}

function parseReconciliation(value: unknown): BiCashflowBankReconciliation {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    total_actual_balance: asNumber(r.total_actual_balance),
    total_calculated_balance: asNumber(r.total_calculated_balance),
    difference: asNumber(r.difference),
    accounts: parseReconAccounts(r.accounts),
  };
}

export function normalizeCashflowDashboard(raw: unknown): BiCashflowDashboard {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;
  const years = Array.isArray(data.available_years)
    ? data.available_years.map((y) => asNumber(y)).filter((y) => y > 0)
    : [];

  return {
    year: asNumber(data.year),
    through_month: asNumber(data.through_month) || 12,
    as_of: asString(data.as_of),
    previous_year: asNumber(data.previous_year),
    summary: {
      ending_cash: asNumber(summary.ending_cash),
      opening_cash: asNumber(summary.opening_cash),
      sales_cash_in: asNumber(summary.sales_cash_in),
      operating_cash_flow: asNumber(summary.operating_cash_flow),
      investing_cash_flow: asNumber(summary.investing_cash_flow),
      financing_cash_flow: asNumber(summary.financing_cash_flow),
      net_cash_change: asNumber(summary.net_cash_change),
      cash_in: asNumber(summary.cash_in),
      cash_out: asNumber(summary.cash_out),
      unclassified_line_count: asNumber(summary.unclassified_line_count),
      unclassified_inflow: asNumber(summary.unclassified_inflow),
      unclassified_outflow: asNumber(summary.unclassified_outflow),
    },
    previous_summary: {
      sales_cash_in: asNumber(previous.sales_cash_in),
      operating_cash_flow: asNumber(previous.operating_cash_flow),
      financing_cash_flow: asNumber(previous.financing_cash_flow),
      net_cash_change: asNumber(previous.net_cash_change),
    },
    monthly_movement: parseMovement(data.monthly_movement),
    balance_trend: parseBalance(data.balance_trend),
    statement_rows: parseStatementRows(data.statement_rows),
    operating_breakdown: parseBreakdown(data.operating_breakdown),
    bank_reconciliation: parseReconciliation(data.bank_reconciliation),
    available_years: years,
  };
}

export function normalizeCashflowDrilldown(raw: unknown): BiCashflowDrilldown {
  const data = (raw ?? {}) as Record<string, unknown>;
  const linesRaw = Array.isArray(data.lines) ? data.lines : [];
  const lines: BiCashflowDrilldownLine[] = linesRaw.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      id: asString(r.id),
      transaction_date: asString(r.transaction_date),
      description: asString(r.description) || "(ไม่มีรายละเอียด)",
      account_no: asString(r.account_no),
      bank_name: asString(r.bank_name),
      amount: asNumber(r.amount),
      direction: asString(r.direction),
      cashflow_code: asString(r.cashflow_code),
      matched_ref_type: asNullableString(r.matched_ref_type),
      reference: asNullableString(r.reference),
      match_status: asString(r.match_status),
    };
  });

  return {
    year: asNumber(data.year),
    month: asNumber(data.month),
    code: asString(data.code),
    from: asString(data.from),
    to: asString(data.to),
    lines,
  };
}

export async function fetchCashflowDashboard(
  supabase: SupabaseClient,
  params: { year: number; throughMonth?: number | null }
): Promise<BiCashflowDashboard> {
  const { data, error } = await supabase.rpc("fn_bi_cashflow_dashboard", {
    p_year: params.year,
    p_through_month: params.throughMonth ?? null,
  });
  if (error) {
    throw new Error(error.message || "Unable to load cashflow dashboard");
  }
  return normalizeCashflowDashboard(data);
}

export async function fetchCashflowDrilldown(
  supabase: SupabaseClient,
  params: { year: number; month: number; code: string; limit?: number }
): Promise<BiCashflowDrilldown> {
  const { data, error } = await supabase.rpc("fn_bi_cashflow_drilldown", {
    p_year: params.year,
    p_month: params.month,
    p_code: params.code,
    p_limit: params.limit ?? 200,
  });
  if (error) {
    throw new Error(error.message || "Unable to load cashflow drilldown");
  }
  return normalizeCashflowDrilldown(data);
}
