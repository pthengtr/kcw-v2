export type BiExpenseSourceFilter = "ALL" | "ENTRIES" | "GENERAL";

export type BiExpenseSummary = {
  amount: number;
  line_count: number;
  item_count: number;
  receipt_count: number;
  general_count: number;
  entries_amount: number;
  general_amount: number;
};

export type BiExpensePreviousSummary = {
  amount: number;
  line_count: number;
  item_count: number;
};

export type BiExpenseSplitRow = {
  key: string;
  label?: string;
  amount: number;
  line_count: number;
};

export type BiExpenseCategoryRow = {
  key: string;
  label: string;
  amount: number;
  item_count: number;
  line_count: number;
};

export type BiExpenseItemRow = {
  key: string;
  label: string;
  category_name: string;
  amount: number;
  line_count: number;
  entries_amount: number;
  general_amount: number;
};

export type BiExpenseTrendRow = {
  period: string;
  amount: number;
  line_count: number;
  entries_amount: number;
  general_amount: number;
};

export type BiExpenseBranchOption = {
  key: string;
  label: string;
};

export type BiExpenseOverview = {
  from: string;
  to: string;
  branch: string | null;
  source: "ENTRIES" | "GENERAL" | null;
  limit: number;
  previous_from: string;
  previous_to: string;
  summary: BiExpenseSummary;
  previous_summary: BiExpensePreviousSummary;
  by_source: BiExpenseSplitRow[];
  by_branch: BiExpenseSplitRow[];
  by_category: BiExpenseCategoryRow[];
  top_items: BiExpenseItemRow[];
  trend_monthly: BiExpenseTrendRow[];
  branches: BiExpenseBranchOption[];
};
