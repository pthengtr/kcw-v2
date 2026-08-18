export type BiProductSearchHit = {
  bcode: string;
  detail: string;
  brand: string | null;
  model: string | null;
  pcode: string | null;
  mcode: string | null;
  category_code: string;
  on_hand_qty: number;
};

export type BiProductSalesIdentity = {
  bcode: string;
  detail: string;
  category_code: string;
  category_name: string;
  code1: string | null;
  code1_name: string | null;
  brand: string | null;
  model: string | null;
  pcode: string | null;
  mcode: string | null;
  on_hand_qty: number;
  costlast: number | null;
  last_sale_date: string | null;
  last_purchase_date: string | null;
};

export type BiProductSalesSummary = {
  revenue_net: number;
  base_qty: number;
  line_count: number;
  bill_count: number;
  avg_unit_price: number;
  cogs: number;
  costed_revenue_net: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  blank_cost_line_count: number;
  hq_revenue_net: number;
  syp_revenue_net: number;
  online_revenue_net: number;
  hq_qty: number;
  syp_qty: number;
  online_qty: number;
};

export type BiProductSalesPreviousSummary = {
  revenue_net: number;
  base_qty: number;
  line_count: number;
  cogs: number;
  gross_profit: number;
};

export type BiProductSalesPurchaseSummary = {
  buy_qty: number;
  buy_amount_net: number;
  buy_bills: number;
  avg_unit_cost: number;
};

export type BiProductSalesBranchRow = {
  key: string;
  revenue_net: number;
  base_qty: number;
  bill_count: number;
  cogs: number;
  gross_profit: number;
};

export type BiProductSalesTrendRow = {
  period: string;
  revenue_net: number;
  base_qty: number;
  bill_count: number;
  hq_revenue_net: number;
  syp_revenue_net: number;
  online_revenue_net: number;
  hq_qty: number;
  syp_qty: number;
  online_qty: number;
  cogs: number;
  gross_profit: number;
};

export type BiProductSalesHistoryRow = {
  bill_date: string;
  reporting_branch: string;
  store_branch: string;
  bill_no: string;
  billtype: string;
  base_qty: number;
  revenue_net: number;
  unit_cost: number | null;
  cogs: number;
  gross_profit: number | null;
};

export type BiProductPurchaseHistoryRow = {
  bill_date: string;
  bill_no: string;
  billtype: string;
  detail: string;
  acctno: string | null;
  base_qty: number;
  unit_price: number;
  amount_net: number;
};

export type BiProductSalesOverview = {
  from: string;
  to: string;
  branch: string | null;
  bcode: string;
  previous_from: string;
  previous_to: string;
  product: BiProductSalesIdentity;
  summary: BiProductSalesSummary;
  previous_summary: BiProductSalesPreviousSummary;
  purchase: BiProductSalesPurchaseSummary;
  by_branch: BiProductSalesBranchRow[];
  trend_daily: BiProductSalesTrendRow[];
  trend_monthly: BiProductSalesTrendRow[];
  sales_history: BiProductSalesHistoryRow[];
  purchase_history: BiProductPurchaseHistoryRow[];
};

export const PURCHASE_BILLTYPE_LABELS: Record<string, string> = {
  "1": "ซื้อเข้า",
  "2": "คืนสินค้า",
  "3": "ปรับปรุง",
};
