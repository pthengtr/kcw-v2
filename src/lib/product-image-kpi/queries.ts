import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProductImageActivity,
  ProductImageKpi,
  ProductImageOperator,
  ProductImageSummary,
} from "./types";

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
  return s === "" ? null : s;
}

export function parseProductImageSummary(value: unknown): ProductImageSummary {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    uploads: asNumber(r.uploads),
    replaces: asNumber(r.replaces),
    deletes: asNumber(r.deletes),
    total_actions: asNumber(r.total_actions),
    unique_products: asNumber(r.unique_products),
  };
}

function parseOperators(value: unknown): ProductImageOperator[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      line_user_id: asString(r.line_user_id),
      display_name: asString(r.display_name) || asString(r.line_user_id),
      uploads_today: asNumber(r.uploads_today),
      replaces_today: asNumber(r.replaces_today),
      deletes_today: asNumber(r.deletes_today),
      total_today: asNumber(r.total_today),
      unique_today: asNumber(r.unique_today),
      uploads: asNumber(r.uploads),
      replaces: asNumber(r.replaces),
      deletes: asNumber(r.deletes),
      total_actions: asNumber(r.total_actions),
      unique_products: asNumber(r.unique_products),
    };
  });
}

function parseActivity(value: unknown): ProductImageActivity[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      created_at: asString(r.created_at),
      display_name: asString(r.display_name),
      line_user_id: asString(r.line_user_id),
      event_type: asString(r.event_type),
      bcode: asString(r.bcode),
      storage_path: asNullableString(r.storage_path),
    };
  });
}

export function parseProductImageKpi(value: unknown): ProductImageKpi {
  const r = (value ?? {}) as Record<string, unknown>;
  return {
    from: asString(r.from),
    to: asString(r.to),
    today: asString(r.today),
    as_of: asString(r.as_of),
    summary_today: parseProductImageSummary(r.summary_today),
    summary_range: parseProductImageSummary(r.summary_range),
    operators: parseOperators(r.operators),
    activity: parseActivity(r.activity),
  };
}

export async function fetchProductImageKpi(
  supabase: SupabaseClient,
  opts: { from?: string | null; to?: string | null } = {}
): Promise<ProductImageKpi> {
  const { data, error } = await supabase.rpc("fn_product_image_kpi", {
    p_from: opts.from ?? null,
    p_to: opts.to ?? null,
  });
  if (error) throw new Error(error.message || "fn_product_image_kpi failed");
  return parseProductImageKpi(data);
}
