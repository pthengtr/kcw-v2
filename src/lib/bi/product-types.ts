import type { BiSplitRow } from "./sales-types";
import type { BiMonthCompareRow } from "./month-compare";

export type BiProductSummary = {
  revenue_net: number;
  base_qty: number;
  sku_count: number;
  line_count: number;
  bill_count: number;
};

export type BiProductPreviousSummary = {
  revenue_net: number;
  base_qty: number;
  sku_count: number;
};

export type BiProductGroupRow = {
  key: string;
  label: string;
  revenue_net: number;
  base_qty: number;
  sku_count: number;
};

export type BiProductRankRow = {
  bcode: string;
  detail: string;
  category_code: string;
  category_name: string;
  code1: string | null;
  code1_name: string | null;
  revenue_net: number;
  base_qty: number;
  line_count: number;
  bill_count: number;
  hq_revenue_net: number;
  syp_revenue_net: number;
  online_revenue_net: number;
  on_hand_qty: number;
  pcode: string | null;
  mcode: string | null;
  brand: string | null;
};

export type BiProductOverview = {
  from: string;
  to: string;
  branch: string | null;
  limit: number;
  previous_from: string;
  previous_to: string;
  summary: BiProductSummary;
  previous_summary: BiProductPreviousSummary;
  by_category: BiProductGroupRow[];
  by_code1: BiProductGroupRow[];
  by_branch: BiSplitRow[];
  top_products: BiProductRankRow[];
  month_columns: string[];
  by_product_month: BiMonthCompareRow[];
};
