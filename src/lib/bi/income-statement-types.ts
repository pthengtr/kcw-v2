/** Thai corporate income tax (ภาษีเงินได้นิติบุคคล) flat rate used for approx. */
export const INCOME_STATEMENT_CIT_RATE = 0.2;

export type BiIncomeStatementBranchFilter = "ALL" | "HQ" | "SYP";

export type BiIncomeStatementSummary = {
  /** VAT-book sales base (BEFORETAX) */
  revenue: number;
  /** VAT purchase goods base */
  purchase_cost: number;
  /** VAT expense (app) base */
  expense: number;
  /** purchase_cost + expense */
  total_cost: number;
  /** revenue − total_cost */
  profit_before_tax: number;
  profit_margin_pct: number | null;
  /** max(0, profit_before_tax) × CIT rate */
  income_tax: number;
  cit_rate: number;
  /** profit_before_tax − income_tax */
  net_profit: number;
  net_margin_pct: number | null;
  sales_bill_count: number;
  purchase_bill_count: number;
  expense_bill_count: number;
};

export type BiIncomeStatementForecast = {
  enabled: boolean;
  as_of: string;
  days_elapsed: number;
  days_in_range: number;
  factor: number;
  revenue: number;
  purchase_cost: number;
  expense: number;
  total_cost: number;
  profit_before_tax: number;
  income_tax: number;
  net_profit: number;
};

export type BiIncomeStatementBranchRow = {
  key: string;
  revenue: number;
  purchase_cost: number;
  expense: number;
  total_cost: number;
  profit_before_tax: number;
  income_tax: number;
  net_profit: number;
};

export type BiIncomeStatementTrendRow = {
  period: string;
  revenue: number;
  purchase_cost: number;
  expense: number;
  total_cost: number;
  profit_before_tax: number;
  income_tax: number;
  net_profit: number;
};

export type BiIncomeStatementOverview = {
  from: string;
  to: string;
  branch: string | null;
  previous_from: string;
  previous_to: string;
  as_of: string;
  cit_rate: number;
  summary: BiIncomeStatementSummary;
  previous_summary: BiIncomeStatementSummary;
  forecast: BiIncomeStatementForecast;
  by_branch: BiIncomeStatementBranchRow[];
  trend_daily: BiIncomeStatementTrendRow[];
  trend_monthly: BiIncomeStatementTrendRow[];
};
