import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiProductGroupRow,
  BiProductOverview,
  BiProductRankRow,
} from "./product-types";
import type { BiSplitRow } from "./sales-types";

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

function parseGroupRows(value: unknown): BiProductGroupRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      revenue_net: asNumber(r.revenue_net),
      base_qty: asNumber(r.base_qty),
      sku_count: asNumber(r.sku_count),
    };
  });
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

function parseProductRows(value: unknown): BiProductRankRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      bcode: asString(r.bcode),
      detail: asString(r.detail),
      category_code: asString(r.category_code),
      category_name: asString(r.category_name),
      code1: asNullableString(r.code1),
      code1_name: asNullableString(r.code1_name),
      revenue_net: asNumber(r.revenue_net),
      base_qty: asNumber(r.base_qty),
      line_count: asNumber(r.line_count),
      bill_count: asNumber(r.bill_count),
      hq_revenue_net: asNumber(r.hq_revenue_net),
      syp_revenue_net: asNumber(r.syp_revenue_net),
      online_revenue_net: asNumber(r.online_revenue_net),
      on_hand_qty: asNumber(r.on_hand_qty),
      pcode: asNullableString(r.pcode),
      mcode: asNullableString(r.mcode),
      brand: asNullableString(r.brand),
    };
  });
}

export function normalizeProductOverview(raw: unknown): BiProductOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;

  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    limit: asNumber(data.limit) || 50,
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    summary: {
      revenue_net: asNumber(summary.revenue_net),
      base_qty: asNumber(summary.base_qty),
      sku_count: asNumber(summary.sku_count),
      line_count: asNumber(summary.line_count),
      bill_count: asNumber(summary.bill_count),
    },
    previous_summary: {
      revenue_net: asNumber(previous.revenue_net),
      base_qty: asNumber(previous.base_qty),
      sku_count: asNumber(previous.sku_count),
    },
    by_category: parseGroupRows(data.by_category),
    by_code1: parseGroupRows(data.by_code1),
    by_branch: parseSplitRows(data.by_branch),
    top_products: parseProductRows(data.top_products),
  };
}

export async function fetchProductOverview(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    branch?: string | null;
    limit?: number;
  }
): Promise<BiProductOverview> {
  const { data, error } = await supabase.rpc("fn_bi_product_overview", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
    p_limit: params.limit ?? 50,
  });

  if (error) {
    throw new Error(error.message || "Unable to load product overview");
  }

  return normalizeProductOverview(data);
}
