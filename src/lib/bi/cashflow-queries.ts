import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiCashflowAccountOption,
  BiCashflowAccountRow,
  BiCashflowCategoryRow,
  BiCashflowLineRow,
  BiCashflowMatchStatusRow,
  BiCashflowOverview,
  BiCashflowReport,
  BiCashflowReportLine,
  BiCashflowReportLineKind,
  BiCashflowTrendRow,
} from "./cashflow-types";

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

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = asString(value).trim();
  return s ? s : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseAccountRows(value: unknown): BiCashflowAccountRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      bank_name: asString(r.bank_name),
      inflow: asNumber(r.inflow),
      outflow: asNumber(r.outflow),
      net: asNumber(r.net),
      line_count: asNumber(r.line_count),
      ending_balance: asNumber(r.ending_balance),
    };
  });
}

function parseCategoryRows(value: unknown): BiCashflowCategoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      inflow: asNumber(r.inflow),
      outflow: asNumber(r.outflow),
      net: asNumber(r.net),
      line_count: asNumber(r.line_count),
    };
  });
}

function parseMatchStatusRows(value: unknown): BiCashflowMatchStatusRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      line_count: asNumber(r.line_count),
      inflow: asNumber(r.inflow),
      outflow: asNumber(r.outflow),
    };
  });
}

function parseTrendRows(value: unknown): BiCashflowTrendRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      period: asString(r.period),
      inflow: asNumber(r.inflow),
      outflow: asNumber(r.outflow),
      net: asNumber(r.net),
      line_count: asNumber(r.line_count),
    };
  });
}

function parseLineRows(value: unknown): BiCashflowLineRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || "(ไม่มีรายละเอียด)",
      account_no: asString(r.account_no),
      txn_date: asString(r.txn_date),
      category_key: asString(r.category_key),
      category_label: asString(r.category_label) || asString(r.category_key),
      amount: asNumber(r.amount),
      match_status: asString(r.match_status),
    };
  });
}

function parseAccounts(value: unknown): BiCashflowAccountOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      bank_name: asString(r.bank_name),
    };
  });
}

function parseReportLines(value: unknown): BiCashflowReportLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const kindRaw = asString(r.kind);
    const kind: BiCashflowReportLineKind =
      kindRaw === "in" ||
      kindRaw === "out" ||
      kindRaw === "forecast" ||
      kindRaw === "balance"
        ? kindRaw
        : "balance";
    return {
      key: asString(r.key),
      label: asString(r.label),
      amount: asNumber(r.amount),
      kind,
      line_count:
        r.line_count == null ? null : asNumber(r.line_count),
    };
  });
}

function parseReport(value: unknown, summary: Record<string, unknown>): BiCashflowReport {
  const r = (value ?? {}) as Record<string, unknown>;
  const lines = parseReportLines(r.lines);
  if (lines.length > 0) {
    return {
      opening_cash: asNumber(r.opening_cash),
      sales_in: asNumber(r.sales_in),
      ar_in: asNumber(r.ar_in),
      supplier_out: asNumber(r.supplier_out),
      payroll_out: asNumber(r.payroll_out),
      opex_out: asNumber(r.opex_out),
      ending_cash: asNumber(r.ending_cash),
      forecast_30d: asNumber(r.forecast_30d),
      forecast_daily_net: asNumber(r.forecast_daily_net),
      other_in: asNumber(r.other_in),
      other_out: asNumber(r.other_out),
      other_count: asNumber(r.other_count),
      lines,
    };
  }

  // Fallback if RPC not yet upgraded
  const opening = asNumber(summary.opening_balance);
  const ending = asNumber(summary.ending_balance);
  const netEx = asNumber(summary.net_ex_internal);
  return {
    opening_cash: opening,
    sales_in: 0,
    ar_in: 0,
    supplier_out: 0,
    payroll_out: 0,
    opex_out: 0,
    ending_cash: ending,
    forecast_30d: ending,
    forecast_daily_net: netEx,
    other_in: 0,
    other_out: 0,
    other_count: 0,
    lines: [
      { key: "opening_cash", label: "เงินสดต้นงวด", amount: opening, kind: "balance", line_count: null },
      { key: "sales_in", label: "รับจากยอดขาย", amount: 0, kind: "in", line_count: 0 },
      { key: "ar_in", label: "รับเงินจากลูกหนี้", amount: 0, kind: "in", line_count: 0 },
      { key: "supplier_out", label: "จ่าย Supplier", amount: 0, kind: "out", line_count: 0 },
      { key: "payroll_out", label: "เงินเดือน", amount: 0, kind: "out", line_count: 0 },
      { key: "opex_out", label: "ค่าใช้จ่ายดำเนินงาน", amount: 0, kind: "out", line_count: 0 },
      { key: "ending_cash", label: "เงินสดคงเหลือ", amount: ending, kind: "balance", line_count: null },
      { key: "forecast_30d", label: "คาดการณ์เงินสด 30 วันข้างหน้า", amount: ending, kind: "forecast", line_count: null },
    ],
  };
}

export function normalizeCashflowOverview(raw: unknown): BiCashflowOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;

  return {
    from: asString(data.from),
    to: asString(data.to),
    account_no: asNullableString(data.account_no),
    include_ignored: asBoolean(data.include_ignored),
    limit: asNumber(data.limit) || 30,
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    summary: {
      inflow: asNumber(summary.inflow),
      outflow: asNumber(summary.outflow),
      net: asNumber(summary.net),
      line_count: asNumber(summary.line_count),
      inflow_count: asNumber(summary.inflow_count),
      outflow_count: asNumber(summary.outflow_count),
      internal_in: asNumber(summary.internal_in),
      internal_out: asNumber(summary.internal_out),
      net_ex_internal: asNumber(summary.net_ex_internal),
      unclassified_count: asNumber(summary.unclassified_count),
      opening_balance: asNumber(summary.opening_balance),
      ending_balance: asNumber(summary.ending_balance),
      account_count: asNumber(summary.account_count),
    },
    previous_summary: {
      inflow: asNumber(previous.inflow),
      outflow: asNumber(previous.outflow),
      net: asNumber(previous.net),
      line_count: asNumber(previous.line_count),
      net_ex_internal: asNumber(previous.net_ex_internal),
    },
    report: parseReport(data.report, summary),
    by_account: parseAccountRows(data.by_account),
    by_category: parseCategoryRows(data.by_category),
    by_match_status: parseMatchStatusRows(data.by_match_status),
    trend_daily: parseTrendRows(data.trend_daily),
    trend_monthly: parseTrendRows(data.trend_monthly),
    top_inflows: parseLineRows(data.top_inflows),
    top_outflows: parseLineRows(data.top_outflows),
    accounts: parseAccounts(data.accounts),
  };
}

export async function fetchCashflowOverview(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    accountNo?: string | null;
    includeIgnored?: boolean;
    limit?: number;
  }
): Promise<BiCashflowOverview> {
  const { data, error } = await supabase.rpc("fn_bi_cashflow_overview", {
    p_from: params.from,
    p_to: params.to,
    p_account_no: params.accountNo ?? null,
    p_include_ignored: params.includeIgnored ?? true,
    p_limit: params.limit ?? 30,
  });

  if (error) {
    throw new Error(error.message || "Unable to load cashflow overview");
  }

  return normalizeCashflowOverview(data);
}
