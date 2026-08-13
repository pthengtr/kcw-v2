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
  BiCashflowReportMonthRow,
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

function parseLineKind(value: unknown): BiCashflowReportLineKind {
  const kindRaw = asString(value);
  if (
    kindRaw === "in" ||
    kindRaw === "out" ||
    kindRaw === "net" ||
    kindRaw === "forecast" ||
    kindRaw === "balance"
  ) {
    return kindRaw;
  }
  return "balance";
}

function computeNetCash(parts: {
  sales_in: number;
  ar_in: number;
  supplier_out: number;
  payroll_out: number;
  opex_out: number;
}): number {
  return (
    parts.sales_in +
    parts.ar_in -
    parts.supplier_out -
    parts.payroll_out -
    parts.opex_out
  );
}

function ensureNetCashLine(
  lines: BiCashflowReportLine[],
  netCash: number
): BiCashflowReportLine[] {
  if (lines.some((line) => line.key === "net_cash")) return lines;
  const netLine: BiCashflowReportLine = {
    key: "net_cash",
    label: "เงินสดสุทธิ",
    amount: netCash,
    kind: "net",
    line_count: null,
  };
  const endingIdx = lines.findIndex((line) => line.key === "ending_cash");
  if (endingIdx >= 0) {
    return [
      ...lines.slice(0, endingIdx),
      netLine,
      ...lines.slice(endingIdx),
    ];
  }
  return [...lines, netLine];
}

function parseReportLines(value: unknown): BiCashflowReportLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label),
      amount: asNumber(r.amount),
      kind: parseLineKind(r.kind),
      line_count:
        r.line_count == null ? null : asNumber(r.line_count),
    };
  });
}

function parseMonthColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item).trim())
    .filter((item) => /^\d{4}-\d{2}$/.test(item));
}

function parseMonthMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    out[key] = asNumber(amount);
  }
  return out;
}

function ensureNetCashMonthRow(
  rows: BiCashflowReportMonthRow[]
): BiCashflowReportMonthRow[] {
  if (rows.some((row) => row.key === "net_cash")) return rows;

  const byKey = new Map(rows.map((row) => [row.key, row]));
  const periods = new Set<string>();
  for (const key of [
    "sales_in",
    "ar_in",
    "supplier_out",
    "payroll_out",
    "opex_out",
  ]) {
    const row = byKey.get(key);
    if (!row) continue;
    for (const period of Object.keys(row.months)) periods.add(period);
  }

  const months: Record<string, number> = {};
  for (const period of periods) {
    months[period] = computeNetCash({
      sales_in: byKey.get("sales_in")?.months[period] ?? 0,
      ar_in: byKey.get("ar_in")?.months[period] ?? 0,
      supplier_out: byKey.get("supplier_out")?.months[period] ?? 0,
      payroll_out: byKey.get("payroll_out")?.months[period] ?? 0,
      opex_out: byKey.get("opex_out")?.months[period] ?? 0,
    });
  }

  const netRow: BiCashflowReportMonthRow = {
    key: "net_cash",
    label: "เงินสดสุทธิ",
    kind: "net",
    total: computeNetCash({
      sales_in: byKey.get("sales_in")?.total ?? 0,
      ar_in: byKey.get("ar_in")?.total ?? 0,
      supplier_out: byKey.get("supplier_out")?.total ?? 0,
      payroll_out: byKey.get("payroll_out")?.total ?? 0,
      opex_out: byKey.get("opex_out")?.total ?? 0,
    }),
    months,
  };

  const endingIdx = rows.findIndex((row) => row.key === "ending_cash");
  if (endingIdx >= 0) {
    return [...rows.slice(0, endingIdx), netRow, ...rows.slice(endingIdx)];
  }
  return [...rows, netRow];
}

function parseReportMonthRows(value: unknown): BiCashflowReportMonthRow[] {
  if (!Array.isArray(value)) return [];
  const rows = value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      kind: parseLineKind(r.kind),
      total: asNumber(r.total),
      months: parseMonthMap(r.months),
    };
  });
  return ensureNetCashMonthRow(rows);
}

function parseReport(value: unknown, summary: Record<string, unknown>): BiCashflowReport {
  const r = (value ?? {}) as Record<string, unknown>;
  const lines = parseReportLines(r.lines);
  if (lines.length > 0) {
    const sales_in = asNumber(r.sales_in);
    const ar_in = asNumber(r.ar_in);
    const supplier_out = asNumber(r.supplier_out);
    const payroll_out = asNumber(r.payroll_out);
    const opex_out = asNumber(r.opex_out);
    const net_cash =
      r.net_cash == null
        ? computeNetCash({
            sales_in,
            ar_in,
            supplier_out,
            payroll_out,
            opex_out,
          })
        : asNumber(r.net_cash);
    return {
      opening_cash: asNumber(r.opening_cash),
      sales_in,
      ar_in,
      supplier_out,
      payroll_out,
      opex_out,
      net_cash,
      ending_cash: asNumber(r.ending_cash),
      forecast_30d: asNumber(r.forecast_30d),
      forecast_daily_net: asNumber(r.forecast_daily_net),
      other_in: asNumber(r.other_in),
      other_out: asNumber(r.other_out),
      other_count: asNumber(r.other_count),
      lines: ensureNetCashLine(lines, net_cash),
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
    net_cash: 0,
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
      { key: "net_cash", label: "เงินสดสุทธิ", amount: 0, kind: "net", line_count: null },
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
    month_columns: parseMonthColumns(data.month_columns),
    report_by_month: parseReportMonthRows(data.report_by_month),
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
    p_include_ignored: params.includeIgnored ?? false,
    p_limit: params.limit ?? 30,
  });

  if (error) {
    throw new Error(error.message || "Unable to load cashflow overview");
  }

  return normalizeCashflowOverview(data);
}
