export type BiIncomeSummary = {
  revenue_net: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  opex: number;
  net_income: number;
  net_margin_pct: number | null;
  bill_count: number;
  line_count: number;
  blank_cost_line_count: number;
};

export type BiIncomePreviousSummary = {
  revenue_net: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  opex: number;
  net_income: number;
  net_margin_pct: number | null;
};

export type BiIncomeBranchRow = {
  key: string;
  revenue_net: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_income: number;
  bill_count: number;
};

export type BiIncomeOpexCategoryRow = {
  key: string;
  label: string;
  amount: number;
};

export type BiIncomeTrendRow = {
  period: string;
  revenue_net: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_income: number;
};

export type BiIncomeOverview = {
  from: string;
  to: string;
  branch: string | null;
  previous_from: string;
  previous_to: string;
  summary: BiIncomeSummary;
  previous_summary: BiIncomePreviousSummary;
  by_branch: BiIncomeBranchRow[];
  opex_by_category: BiIncomeOpexCategoryRow[];
  trend_daily: BiIncomeTrendRow[];
  trend_monthly: BiIncomeTrendRow[];
};
