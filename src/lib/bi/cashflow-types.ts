export type BiCashflowSummary = {
  inflow: number;
  outflow: number;
  net: number;
  line_count: number;
  inflow_count: number;
  outflow_count: number;
  internal_in: number;
  internal_out: number;
  net_ex_internal: number;
  unclassified_count: number;
  opening_balance: number;
  ending_balance: number;
  account_count: number;
};

export type BiCashflowPreviousSummary = {
  inflow: number;
  outflow: number;
  net: number;
  line_count: number;
  net_ex_internal: number;
};

export type BiCashflowAccountRow = {
  key: string;
  label: string;
  bank_name: string;
  inflow: number;
  outflow: number;
  net: number;
  line_count: number;
  ending_balance: number;
};

export type BiCashflowCategoryRow = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  line_count: number;
};

export type BiCashflowMatchStatusRow = {
  key: string;
  line_count: number;
  inflow: number;
  outflow: number;
};

export type BiCashflowTrendRow = {
  period: string;
  inflow: number;
  outflow: number;
  net: number;
  line_count: number;
};

export type BiCashflowLineRow = {
  key: string;
  label: string;
  account_no: string;
  txn_date: string;
  category_key: string;
  category_label: string;
  amount: number;
  match_status: string;
};

export type BiCashflowAccountOption = {
  key: string;
  label: string;
  bank_name: string;
};

export type BiCashflowOverview = {
  from: string;
  to: string;
  account_no: string | null;
  include_ignored: boolean;
  limit: number;
  previous_from: string;
  previous_to: string;
  summary: BiCashflowSummary;
  previous_summary: BiCashflowPreviousSummary;
  by_account: BiCashflowAccountRow[];
  by_category: BiCashflowCategoryRow[];
  by_match_status: BiCashflowMatchStatusRow[];
  trend_daily: BiCashflowTrendRow[];
  trend_monthly: BiCashflowTrendRow[];
  top_inflows: BiCashflowLineRow[];
  top_outflows: BiCashflowLineRow[];
  accounts: BiCashflowAccountOption[];
};
