import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  StockAuditBranch,
  StockAuditBucket,
  StockAuditDailyMark,
  StockAuditLookup,
  StockAuditOpenBatchSummary,
  StockAuditOperatorMark,
  StockAuditOverview,
  StockAuditRow,
  StockAuditSummary,
} from "./types";

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
  return s === "" ? null : s;
}

function asBranch(value: unknown): StockAuditBranch {
  return asString(value).toUpperCase() === "SYP" ? "SYP" : "HQ";
}

function asBucket(value: unknown): StockAuditBucket {
  const s = asString(value);
  if (
    s === "never" ||
    s === "d30" ||
    s === "d90" ||
    s === "d180" ||
    s === "d365" ||
    s === "over_365"
  ) {
    return s;
  }
  return "never";
}

function parseSummary(value: unknown): StockAuditSummary {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    total: asNumber(r.total),
    never_count: asNumber(r.never_count),
    d30_count: asNumber(r.d30_count),
    d90_count: asNumber(r.d90_count),
    d180_count: asNumber(r.d180_count),
    d365_count: asNumber(r.d365_count),
    over_365_count: asNumber(r.over_365_count),
    app_marked_count: asNumber(r.app_marked_count),
    marked_today_count: asNumber(r.marked_today_count),
    marked_week_count: asNumber(r.marked_week_count),
  };
}

function parseRow(value: unknown): StockAuditRow {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    bcode: asString(r.bcode),
    descr: asString(r.descr),
    brand: asString(r.brand),
    model: asString(r.model),
    location1: asString(r.location1),
    category: asString(r.category),
    qty: asNumber(r.qty),
    sell_qty_period: asNumber(r.sell_qty_period),
    sell_revenue_period: asNumber(r.sell_revenue_period),
    pos_dateaudit: asNullableString(r.pos_dateaudit),
    app_dateaudit: asNullableString(r.app_dateaudit),
    effective_date: asNullableString(r.effective_date),
    days_since: asNullableNumber(r.days_since),
    bucket: asBucket(r.bucket),
  };
}

function parseOpenBatch(value: unknown): StockAuditOpenBatchSummary {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    id: asString(r.id),
    created_at: asString(r.created_at),
    created_by: asString(r.created_by),
    target_count: asNumber(r.target_count),
    pending_count: asNumber(r.pending_count),
    done_count: asNumber(r.done_count),
  };
}

function parseDailyMark(value: unknown): StockAuditDailyMark {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    date: asString(r.date).slice(0, 10),
    count: asNumber(r.count),
  };
}

function parseOperatorMark(value: unknown): StockAuditOperatorMark {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    name: asString(r.name) || "unknown",
    today_count: asNumber(r.today_count),
    week_count: asNumber(r.week_count),
  };
}

function parseOverview(value: unknown): StockAuditOverview {
  const r = (value ?? {}) as Record<string, unknown>;
  const bucketRaw = asNullableString(r.bucket);
  return {
    branch: asBranch(r.branch),
    with_stock_only: Boolean(r.with_stock_only ?? true),
    as_of: asString(r.as_of),
    sales_from: asNullableString(r.sales_from),
    sales_to: asNullableString(r.sales_to),
    summary: parseSummary(r.summary),
    daily_marks: Array.isArray(r.daily_marks)
      ? r.daily_marks.map(parseDailyMark)
      : [],
    operator_marks: Array.isArray(r.operator_marks)
      ? r.operator_marks.map(parseOperatorMark)
      : [],
    open_batches: Array.isArray(r.open_batches)
      ? r.open_batches.map(parseOpenBatch)
      : [],
    rows: Array.isArray(r.rows) ? r.rows.map(parseRow) : [],
    row_total: asNumber(r.row_total),
    limit: asNumber(r.limit),
    offset: asNumber(r.offset),
    bucket: bucketRaw ? asBucket(bucketRaw) : null,
  };
}

async function rpcJson(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message || `RPC ${fn} failed`);
  return data;
}

export async function fetchStockAuditOverview(
  supabase: SupabaseClient,
  opts: {
    branch?: StockAuditBranch;
    withStockOnly?: boolean;
    bucket?: StockAuditBucket | null;
    limit?: number;
    offset?: number;
  } = {}
): Promise<StockAuditOverview> {
  const data = await rpcJson(supabase, "fn_stock_audit_overview", {
    p_branch: opts.branch ?? "HQ",
    p_with_stock_only: opts.withStockOnly ?? true,
    p_bucket: opts.bucket ?? null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });
  return parseOverview(data);
}

export async function lookupStockAuditProduct(
  supabase: SupabaseClient,
  opts: { branch: StockAuditBranch; bcode: string }
): Promise<StockAuditLookup> {
  const data = (await rpcJson(supabase, "fn_stock_audit_lookup", {
    p_branch: opts.branch,
    p_bcode: opts.bcode,
  })) as Record<string, unknown>;

  return {
    found: Boolean(data.found),
    branch: asBranch(data.branch),
    bcode: asString(data.bcode),
    descr: asNullableString(data.descr) ?? undefined,
    brand: asNullableString(data.brand) ?? undefined,
    model: asNullableString(data.model) ?? undefined,
    location1: asNullableString(data.location1) ?? undefined,
    qty: data.qty == null ? undefined : asNumber(data.qty),
    sell_qty_period:
      data.sell_qty_period == null ? undefined : asNumber(data.sell_qty_period),
    sell_revenue_period:
      data.sell_revenue_period == null
        ? undefined
        : asNumber(data.sell_revenue_period),
    pos_dateaudit: asNullableString(data.pos_dateaudit),
    app_dateaudit: asNullableString(data.app_dateaudit),
    app_audited_by: asNullableString(data.app_audited_by),
    audit_count:
      data.audit_count == null ? null : asNullableNumber(data.audit_count),
    effective_date: asNullableString(data.effective_date),
  };
}
