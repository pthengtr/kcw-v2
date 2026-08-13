import type { SupabaseClient } from "@supabase/supabase-js";

import type { StockAuditBranch } from "./types";
import type {
  StockWorkCounts,
  StockWorkDaily,
  StockWorkKpi,
  StockWorkOperator,
} from "./work-types";

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

function asBranch(value: unknown): StockAuditBranch {
  return asString(value).toUpperCase() === "SYP" ? "SYP" : "HQ";
}

function emptyCounts(): StockWorkCounts {
  return {
    count_correct: 0,
    count_variance: 0,
    count_edit: 0,
    audit_approve: 0,
    audit_reject: 0,
    total_actions: 0,
    completed_counts: 0,
  };
}

export function parseStockWorkCounts(value: unknown): StockWorkCounts {
  const r = (value ?? {}) as Record<string, unknown>;
  const count_correct = asNumber(r.count_correct);
  const count_variance = asNumber(r.count_variance);
  const completedFromParts = count_correct + count_variance;
  return {
    count_correct,
    count_variance,
    count_edit: asNumber(r.count_edit),
    audit_approve: asNumber(r.audit_approve),
    audit_reject: asNumber(r.audit_reject),
    total_actions: asNumber(r.total_actions),
    completed_counts:
      r.completed_counts == null
        ? completedFromParts
        : asNumber(r.completed_counts),
  };
}

function parseDaily(value: unknown): StockWorkDaily[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      date: asString(r.date),
      ...parseStockWorkCounts(r),
    };
  });
}

function parseOperators(value: unknown): StockWorkOperator[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      line_user_id: asString(r.line_user_id),
      display_name: asString(r.display_name) || asString(r.line_user_id),
      today: parseStockWorkCounts(r.today),
      week: parseStockWorkCounts(r.week),
    };
  });
}

export function parseStockWorkKpi(value: unknown): StockWorkKpi {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    branch: asBranch(r.branch),
    as_of: asString(r.as_of),
    today: asString(r.today),
    summary_today: parseStockWorkCounts(r.summary_today) ?? emptyCounts(),
    summary_week: parseStockWorkCounts(r.summary_week) ?? emptyCounts(),
    daily: parseDaily(r.daily),
    operators: parseOperators(r.operators),
  };
}

export async function fetchStockWorkKpi(
  supabase: SupabaseClient,
  opts: { branch?: StockAuditBranch } = {}
): Promise<StockWorkKpi> {
  const { data, error } = await supabase.rpc("fn_stock_work_kpi", {
    p_branch: opts.branch ?? "HQ",
  });
  if (error) throw new Error(error.message || "fn_stock_work_kpi failed");
  return parseStockWorkKpi(data);
}
