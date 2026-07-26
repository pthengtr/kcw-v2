import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiExpenseBranchOption,
  BiExpenseCategoryRow,
  BiExpenseItemMonthRow,
  BiExpenseItemRow,
  BiExpenseOverview,
  BiExpenseSplitRow,
  BiExpenseTrendRow,
} from "./expense-types";

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

function parseSplitRows(value: unknown): BiExpenseSplitRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asNullableString(r.label) ?? undefined,
      amount: asNumber(r.amount),
      line_count: asNumber(r.line_count),
    };
  });
}

function parseCategoryRows(value: unknown): BiExpenseCategoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      amount: asNumber(r.amount),
      item_count: asNumber(r.item_count),
      line_count: asNumber(r.line_count),
    };
  });
}

function parseItemRows(value: unknown): BiExpenseItemRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      category_name: asString(r.category_name),
      amount: asNumber(r.amount),
      line_count: asNumber(r.line_count),
      entries_amount: asNumber(r.entries_amount),
      general_amount: asNumber(r.general_amount),
    };
  });
}

function parseTrendRows(value: unknown): BiExpenseTrendRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      period: asString(r.period),
      amount: asNumber(r.amount),
      line_count: asNumber(r.line_count),
      entries_amount: asNumber(r.entries_amount),
      general_amount: asNumber(r.general_amount),
    };
  });
}

function parseBranches(value: unknown): BiExpenseBranchOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
    };
  });
}

function parseMonthColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

function parseItemMonthRows(value: unknown): BiExpenseItemMonthRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const monthsRaw = (r.months ?? {}) as Record<string, unknown>;
    const months: Record<string, number> = {};
    for (const [period, amount] of Object.entries(monthsRaw)) {
      months[period] = asNumber(amount);
    }
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      category_name: asString(r.category_name),
      total: asNumber(r.total),
      months,
    };
  });
}

export function normalizeExpenseOverview(raw: unknown): BiExpenseOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;
  const source = asNullableString(data.source);

  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    source:
      source === "ENTRIES" || source === "GENERAL" ? source : null,
    limit: asNumber(data.limit) || 30,
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    summary: {
      amount: asNumber(summary.amount),
      line_count: asNumber(summary.line_count),
      item_count: asNumber(summary.item_count),
      receipt_count: asNumber(summary.receipt_count),
      general_count: asNumber(summary.general_count),
      entries_amount: asNumber(summary.entries_amount),
      general_amount: asNumber(summary.general_amount),
    },
    previous_summary: {
      amount: asNumber(previous.amount),
      line_count: asNumber(previous.line_count),
      item_count: asNumber(previous.item_count),
    },
    by_source: parseSplitRows(data.by_source),
    by_branch: parseSplitRows(data.by_branch),
    by_category: parseCategoryRows(data.by_category),
    top_items: parseItemRows(data.top_items),
    trend_monthly: parseTrendRows(data.trend_monthly),
    month_columns: parseMonthColumns(data.month_columns),
    by_item_month: parseItemMonthRows(data.by_item_month),
    branches: parseBranches(data.branches),
  };
}

export async function fetchExpenseOverview(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    branch?: string | null;
    source?: string | null;
    limit?: number;
  }
): Promise<BiExpenseOverview> {
  const { data, error } = await supabase.rpc("fn_bi_expense_overview", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
    p_source: params.source ?? null,
    p_limit: params.limit ?? 30,
    p_timezone: "Asia/Bangkok",
  });

  if (error) {
    throw new Error(error.message || "Unable to load expense overview");
  }

  return normalizeExpenseOverview(data);
}
