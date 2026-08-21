import type { SupabaseClient } from "@supabase/supabase-js";

import { categoryLabel, code1Label } from "./icmas-labels";
import type {
  BiProductPurchaseHistoryRow,
  BiProductSalesBranchRow,
  BiProductSalesHistoryRow,
  BiProductSalesOverview,
  BiProductSalesTrendRow,
  BiProductSearchHit,
} from "./product-sales-types";

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

function asIsoDate(value: unknown): string | null {
  const s = asNullableString(value);
  if (!s) return null;
  return s.slice(0, 10);
}

export function normalizeProductSearch(raw: unknown): BiProductSearchHit[] {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(data.products) ? data.products : [];
  return rows.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      bcode: asString(r.bcode),
      detail: asString(r.detail),
      brand: asNullableString(r.brand),
      model: asNullableString(r.model),
      pcode: asNullableString(r.pcode),
      mcode: asNullableString(r.mcode),
      category_code: asString(r.category_code),
      on_hand_qty: asNumber(r.on_hand_qty),
    };
  });
}

function parseBranchRows(value: unknown): BiProductSalesBranchRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      revenue_net: asNumber(r.revenue_net),
      base_qty: asNumber(r.base_qty),
      bill_count: asNumber(r.bill_count),
      cogs: asNumber(r.cogs),
      gross_profit: asNumber(r.gross_profit),
    };
  });
}

function parseTrendRows(value: unknown): BiProductSalesTrendRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      period: asString(r.period),
      revenue_net: asNumber(r.revenue_net),
      base_qty: asNumber(r.base_qty),
      bill_count: asNumber(r.bill_count),
      hq_revenue_net: asNumber(r.hq_revenue_net),
      syp_revenue_net: asNumber(r.syp_revenue_net),
      online_revenue_net: asNumber(r.online_revenue_net),
      hq_qty: asNumber(r.hq_qty),
      syp_qty: asNumber(r.syp_qty),
      online_qty: asNumber(r.online_qty),
      cogs: asNumber(r.cogs),
      gross_profit: asNumber(r.gross_profit),
    };
  });
}

function parseSalesHistory(value: unknown): BiProductSalesHistoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      bill_date: asIsoDate(r.bill_date) ?? "",
      reporting_branch: asString(r.reporting_branch),
      store_branch: asString(r.store_branch),
      bill_no: asString(r.bill_no),
      billtype: asString(r.billtype),
      base_qty: asNumber(r.base_qty),
      revenue_net: asNumber(r.revenue_net),
      unit_cost: asNullableNumber(r.unit_cost),
      cogs: asNumber(r.cogs),
      gross_profit: asNullableNumber(r.gross_profit),
    };
  });
}

function parsePurchaseHistory(value: unknown): BiProductPurchaseHistoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      bill_date: asIsoDate(r.bill_date) ?? "",
      bill_no: asString(r.bill_no),
      billtype: asString(r.billtype),
      detail: asString(r.detail),
      acctno: asNullableString(r.acctno),
      base_qty: asNumber(r.base_qty),
      unit_price: asNumber(r.unit_price),
      amount_net: asNumber(r.amount_net),
    };
  });
}

export function normalizeProductSales(raw: unknown): BiProductSalesOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  const product = (data.product ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;
  const purchase = (data.purchase ?? {}) as Record<string, unknown>;
  const category_code = asString(product.category_code);
  const code1 = asNullableString(product.code1);

  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    bcode: asString(data.bcode) || asString(product.bcode),
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    product: {
      bcode: asString(product.bcode),
      detail: asString(product.detail),
      category_code,
      category_name: categoryLabel(category_code),
      code1,
      code1_name: code1Label(code1),
      brand: asNullableString(product.brand),
      model: asNullableString(product.model),
      pcode: asNullableString(product.pcode),
      mcode: asNullableString(product.mcode),
      on_hand_qty: asNumber(product.on_hand_qty),
      costlast: asNullableNumber(product.costlast),
      last_sale_date: asIsoDate(product.last_sale_date),
      last_purchase_date: asIsoDate(product.last_purchase_date),
    },
    summary: {
      revenue_net: asNumber(summary.revenue_net),
      base_qty: asNumber(summary.base_qty),
      line_count: asNumber(summary.line_count),
      bill_count: asNumber(summary.bill_count),
      avg_unit_price: asNumber(summary.avg_unit_price),
      cogs: asNumber(summary.cogs),
      costed_revenue_net: asNumber(summary.costed_revenue_net),
      gross_profit: asNumber(summary.gross_profit),
      gross_margin_pct: asNullableNumber(summary.gross_margin_pct),
      blank_cost_line_count: asNumber(summary.blank_cost_line_count),
      hq_revenue_net: asNumber(summary.hq_revenue_net),
      syp_revenue_net: asNumber(summary.syp_revenue_net),
      online_revenue_net: asNumber(summary.online_revenue_net),
      hq_qty: asNumber(summary.hq_qty),
      syp_qty: asNumber(summary.syp_qty),
      online_qty: asNumber(summary.online_qty),
    },
    previous_summary: {
      revenue_net: asNumber(previous.revenue_net),
      base_qty: asNumber(previous.base_qty),
      line_count: asNumber(previous.line_count),
      cogs: asNumber(previous.cogs),
      gross_profit: asNumber(previous.gross_profit),
    },
    purchase: {
      buy_qty: asNumber(purchase.buy_qty),
      buy_amount_net: asNumber(purchase.buy_amount_net),
      buy_bills: asNumber(purchase.buy_bills),
      avg_unit_cost: asNumber(purchase.avg_unit_cost),
    },
    by_branch: parseBranchRows(data.by_branch),
    trend_daily: parseTrendRows(data.trend_daily),
    trend_monthly: parseTrendRows(data.trend_monthly),
    sales_history: parseSalesHistory(data.sales_history),
    purchase_history: parsePurchaseHistory(data.purchase_history),
  };
}

export async function searchBiProducts(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<BiProductSearchHit[]> {
  const { data, error } = await supabase.rpc("fn_bi_product_search", {
    p_q: query,
    p_limit: limit,
  });
  if (error) {
    throw new Error(error.message || "Unable to search products");
  }
  return normalizeProductSearch(data);
}

export async function fetchProductSales(
  supabase: SupabaseClient,
  params: {
    bcode: string;
    from: string;
    to: string;
    branch?: string | null;
    historyLimit?: number;
  }
): Promise<BiProductSalesOverview> {
  const { data, error } = await supabase.rpc("fn_bi_product_sales", {
    p_bcode: params.bcode,
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
    p_history_limit: params.historyLimit ?? 40,
  });
  if (error) {
    throw new Error(error.message || "Unable to load product sales");
  }
  return normalizeProductSales(data);
}
