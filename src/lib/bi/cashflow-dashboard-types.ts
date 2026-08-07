export type BiCashflowDashboardSummary = {
  ending_cash: number;
  opening_cash: number;
  sales_cash_in: number;
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  net_cash_change: number;
  cash_in: number;
  cash_out: number;
  unclassified_line_count: number;
  unclassified_inflow: number;
  unclassified_outflow: number;
};

export type BiCashflowDashboardPreviousSummary = {
  sales_cash_in: number;
  operating_cash_flow: number;
  financing_cash_flow: number;
  net_cash_change: number;
};

export type BiCashflowMonthMovement = {
  month: number;
  period: string;
  has_data: boolean;
  cash_in: number | null;
  cash_out: number | null;
  net_change: number | null;
};

export type BiCashflowBalanceTrend = {
  month: number;
  period: string;
  has_data: boolean;
  opening_cash: number | null;
  ending_cash: number | null;
};

export type BiCashflowStatementRowKind =
  | "section"
  | "line"
  | "subtotal"
  | "total"
  | "balance";

export type BiCashflowStatementRow = {
  key: string;
  kind: BiCashflowStatementRowKind;
  code?: string;
  label: string;
  label_th: string;
  sign?: number;
  months?: Record<string, number | null>;
  ytd?: number | null;
};

export type BiCashflowOperatingBreakdown = {
  key: string;
  label: string;
  label_th: string;
  amount: number;
  share_of_sales: number | null;
};

export type BiCashflowBankReconAccount = {
  key: string;
  account_code: string;
  account_name: string;
  opening_balance: number;
  cash_in: number;
  cash_out: number;
  calculated_closing: number;
  actual_balance: number;
  variance: number;
};

export type BiCashflowBankReconciliation = {
  total_actual_balance: number;
  total_calculated_balance: number;
  difference: number;
  accounts: BiCashflowBankReconAccount[];
};

export type BiCashflowDashboard = {
  year: number;
  through_month: number;
  as_of: string;
  previous_year: number;
  summary: BiCashflowDashboardSummary;
  previous_summary: BiCashflowDashboardPreviousSummary;
  monthly_movement: BiCashflowMonthMovement[];
  balance_trend: BiCashflowBalanceTrend[];
  statement_rows: BiCashflowStatementRow[];
  operating_breakdown: BiCashflowOperatingBreakdown[];
  bank_reconciliation: BiCashflowBankReconciliation;
  available_years: number[];
};

export type BiCashflowDrilldownLine = {
  id: string;
  transaction_date: string;
  description: string;
  account_no: string;
  bank_name: string;
  amount: number;
  direction: string;
  cashflow_code: string;
  matched_ref_type: string | null;
  reference: string | null;
  match_status: string;
};

export type BiCashflowDrilldown = {
  year: number;
  month: number;
  code: string;
  from: string;
  to: string;
  lines: BiCashflowDrilldownLine[];
};
