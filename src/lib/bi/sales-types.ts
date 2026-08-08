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
};

export type BiReportId =
  | "sales"
  | "sales-compare"
  | "customers"
  | "products"
  | "product-movement"
  | "expenses"
  | "cash-flow"
  | "income"
  | "income-statement"
  | "vat";

export type BiReportNavItem = {
  id: BiReportId;
  href: string;
  label: string;
  description: string;
  available: boolean;
};
