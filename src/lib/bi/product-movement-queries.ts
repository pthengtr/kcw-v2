import type { SupabaseClient } from "@supabase/supabase-js";

import { categoryLabel, code1Label } from "./icmas-labels";
import type {
  BiDeadSort,
  BiDeadStockRow,
  BiDeadTier,
  BiProductMovement,
  BiProductMovementMode,
  BiStockMoreRow,
} from "./product-movement-types";

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

function asDeadTier(value: unknown): BiDeadTier {
  const s = asString(value);
  if (s === "red" || s === "orange" || s === "yellow") return s;
  return "yellow";
}

function asDeadSort(value: unknown): BiDeadSort {
  return asString(value) === "recent" ? "recent" : "deep";
}

function asMode(value: unknown): BiProductMovementMode {
  const s = asString(value);
  if (s === "stock_more" || s === "dead" || s === "both") return s;
  return "both";
}

function asOptionalDeadTier(value: unknown): BiDeadTier | null {
  const s = asString(value);
  if (s === "red" || s === "orange" || s === "yellow") return s;
  return null;
}

function parseStockMore(value: unknown): BiStockMoreRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const category_code = asString(r.category_code);
    const code1 = asNullableString(r.code1);
    return {
      bcode: asString(r.bcode),
      detail: asString(r.detail),
      category_code,
      category_name: categoryLabel(category_code),
      code1,
      code1_name: code1Label(code1),
      sell_qty: asNumber(r.sell_qty),
      sell_bills: asNumber(r.sell_bills),
      sell_days: asNumber(r.sell_days),
      buy_qty: asNumber(r.buy_qty),
      buy_bills: asNumber(r.buy_bills),
      on_hand_qty: asNumber(r.on_hand_qty),
      last_sale_date: asNullableString(r.last_sale_date),
      last_purchase_date: asNullableString(r.last_purchase_date),
    };
  });
}

function parseDeadStock(value: unknown): BiDeadStockRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const category_code = asString(r.category_code);
    const code1 = asNullableString(r.code1);
    return {
      bcode: asString(r.bcode),
      detail: asString(r.detail),
      category_code,
      category_name: categoryLabel(category_code),
      code1,
      code1_name: code1Label(code1),
      on_hand_qty: asNumber(r.on_hand_qty),
      last_purchase_date: asNullableString(r.last_purchase_date),
      last_sale_date: asNullableString(r.last_sale_date),
      days_since_purchase: asNullableNumber(r.days_since_purchase),
      days_since_sale: asNullableNumber(r.days_since_sale),
      no_move_since_purchase: Boolean(r.no_move_since_purchase),
      dead_tier: asDeadTier(r.dead_tier),
      sell_qty_period: asNumber(r.sell_qty_period),
      buy_qty_period: asNumber(r.buy_qty_period),
    };
  });
}

export function normalizeProductMovement(raw: unknown): BiProductMovement {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;

  const dead_limit = asNumber(data.dead_limit);
  const dead_offset = asNumber(data.dead_offset);
  const dead_sort = asDeadSort(data.dead_sort);
  const dead_stock = parseDeadStock(data.dead_stock);
  const dead_returned_count =
    data.dead_returned_count == null
      ? dead_stock.length
      : asNumber(data.dead_returned_count);
  const dead_total_count = asNumber(summary.dead_total_count);
  const dead_has_more =
    data.dead_has_more == null
      ? dead_offset + dead_returned_count < dead_total_count
      : Boolean(data.dead_has_more);

  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    mode: asMode(data.mode),
    stock_limit: asNumber(data.stock_limit),
    dead_limit,
    dead_offset,
    dead_sort,
    dead_tier: asOptionalDeadTier(data.dead_tier),
    dead_category: asNullableString(data.dead_category),
    dead_returned_count,
    dead_has_more,
    summary: {
      sold_sku_count: asNumber(summary.sold_sku_count),
      sell_qty: asNumber(summary.sell_qty),
      bought_sku_count: asNumber(summary.bought_sku_count),
      buy_qty: asNumber(summary.buy_qty),
      dead_yellow_count: asNumber(summary.dead_yellow_count),
      dead_orange_count: asNumber(summary.dead_orange_count),
      dead_red_count: asNumber(summary.dead_red_count),
      dead_total_count,
      dead_category_total:
        summary.dead_category_total == null
          ? dead_total_count
          : asNumber(summary.dead_category_total),
    },
    stock_more: parseStockMore(data.stock_more),
    dead_stock,
  };
}

export async function fetchProductMovement(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    branch?: string | null;
    stockLimit?: number;
    deadLimit?: number;
    deadOffset?: number;
    deadSort?: BiDeadSort;
    mode?: BiProductMovementMode;
    deadTier?: BiDeadTier | null;
    category?: string | null;
  }
): Promise<BiProductMovement> {
  const rpcArgs = {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
    p_stock_limit: params.stockLimit ?? 50,
    p_dead_limit: params.deadLimit ?? 100,
    p_dead_offset: params.deadOffset ?? 0,
    p_dead_sort: params.deadSort ?? "deep",
    p_mode: params.mode ?? "both",
    p_dead_tier: params.deadTier ?? null,
    p_category: params.category ?? null,
  };

  const run = () => supabase.rpc("fn_bi_product_movement", rpcArgs);

  let { data, error } = await run();

  // One retry on transient statement timeout / gateway blips
  if (
    error &&
    /timeout|canceling statement|57014|503|502/i.test(error.message || "")
  ) {
    ({ data, error } = await run());
  }

  if (error) {
    throw new Error(error.message || "Unable to load product movement");
  }

  return normalizeProductMovement(data);
}
