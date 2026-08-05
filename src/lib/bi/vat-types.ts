export type BiVatBranchFilter = "ALL" | "HQ" | "SYP";

export type BiVatSummary = {
  sales_before: number;
  sales_vat: number;
  sales_bill_count: number;
  purchase_before: number;
  purchase_vat: number;
  purchase_bill_count: number;
  expense_before: number;
  expense_vat: number;
  expense_bill_count: number;
  net_vat: number;
};

export type BiVatForecast = {
  enabled: boolean;
  as_of: string;
  days_elapsed: number;
  days_in_range: number;
  factor: number;
  sales_vat: number;
  purchase_vat: number;
  expense_vat: number;
  net_vat: number;
  sales_before: number;
  purchase_before: number;
  expense_before: number;
};

export type BiVatDocRow = {
  key: string;
  branch?: string;
  bill_count: number;
  beforetax: number;
  tax: number;
  aftertax: number;
};

export type BiVatBranchRow = {
  key: string;
  sales_vat: number;
  sales_before: number;
  purchase_vat: number;
  purchase_before: number;
  expense_vat: number;
  expense_before: number;
  net_vat: number;
};

export type BiVatTrendRow = {
  period: string;
  sales_vat: number;
  purchase_vat: number;
  expense_vat: number;
  net_vat: number;
};

export type BiVatOverview = {
  from: string;
  to: string;
  branch: string | null;
  previous_from: string;
  previous_to: string;
  as_of: string;
  summary: BiVatSummary;
  previous_summary: BiVatSummary;
  forecast: BiVatForecast;
  by_sales_doc: BiVatDocRow[];
  by_purchase_book: BiVatDocRow[];
  by_expense_doc: BiVatDocRow[];
  by_branch: BiVatBranchRow[];
  trend_daily: BiVatTrendRow[];
  trend_monthly: BiVatTrendRow[];
};
