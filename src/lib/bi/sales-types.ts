export type BiBranchFilter = "ALL" | "HQ" | "SYP" | "ONLINE";

export type BiPeriodPreset = "month" | "ytd" | "custom";

export type BiCustomDateMode = "single" | "month" | "range";

export type BiSplitRow = {
  key: string;
  revenue_net: number;
  bill_count: number;
};

export type BiTrendRow = {
  period: string;
  revenue_net: number;
  bill_count: number;
  hq_revenue_net: number;
  syp_revenue_net: number;
  online_revenue_net: number;
};

export type BiOnlineMarginSummary = {
  revenue_net: number;
  fee_baht: number;
  fifo_ext_cost: number;
  profit: number;
  margin_pct: number | null;
  bill_count: number;
  fee_bill_count: number;
  fifo_bill_count: number;
  fifo_partial_bill_count: number;
  fifo_missing_bill_count: number;
};

export type BiOnlinePlatformRow = {
  platform: string;
  revenue_net: number;
  fee_baht: number;
  fifo_ext_cost: number;
  profit: number;
  bill_count: number;
};

export type BiOnlineFeeRow = {
  fee_name: string;
  fee_baht: number;
};

export type BiOnlineTrendRow = {
  period: string;
  revenue_net: number;
  fee_baht: number;
  fifo_ext_cost: number;
  profit: number;
  bill_count: number;
};

export type BiOnlineMargin = BiOnlineMarginSummary & {
  by_platform: BiOnlinePlatformRow[];
  by_fee: BiOnlineFeeRow[];
  trend_daily: BiOnlineTrendRow[];
  trend_monthly: BiOnlineTrendRow[];
};

export type BiSalesSummary = {
  revenue_net: number;
  vat_baht: number;
  bill_count: number;
  avg_bill: number;
};

export type BiSalesPreviousSummary = {
  revenue_net: number;
  vat_baht: number;
  bill_count: number;
};

export type BiSalesOverview = {
  from: string;
  to: string;
  branch: string | null;
  previous_from: string;
  previous_to: string;
  summary: BiSalesSummary;
  previous_summary: BiSalesPreviousSummary;
  by_sales_type: BiSplitRow[];
  by_branch: BiSplitRow[];
  by_channel: BiSplitRow[];
  by_billtype: BiSplitRow[];
  trend_daily: BiTrendRow[];
  trend_monthly: BiTrendRow[];
  online_margin: BiOnlineMargin;
  previous_online_margin: BiOnlineMarginSummary;
};

export type BiReportId =
  | "sales"
  | "sales-compare"
  | "customers"
  | "products"
  | "product-sales"
  | "product-movement"
  | "expenses"
  | "cash-flow"
  | "income"
  | "income-statement"
  | "vat";

export type BiReportGroupId = "sales" | "products" | "finance";

export type BiReportNavItem = {
  id: BiReportId;
  href: string;
  label: string;
  /** RBAC page_key that gates this report. */
  pageKey: string;
  /** Optional longer hint; sidebar shows label only. */
  description?: string;
  available: boolean;
};

export type BiReportNavGroup = {
  id: BiReportGroupId;
  label: string;
  reports: BiReportNavItem[];
};
