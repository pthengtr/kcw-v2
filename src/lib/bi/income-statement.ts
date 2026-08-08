import {
  INCOME_STATEMENT_CIT_RATE,
  type BiIncomeStatementBranchRow,
  type BiIncomeStatementForecast,
  type BiIncomeStatementOverview,
  type BiIncomeStatementSummary,
  type BiIncomeStatementTrendRow,
} from "./income-statement-types";
import type { BiExpenseOverview, BiExpenseTrendRow } from "./expense-types";
import type {
  BiVatBranchRow,
  BiVatForecast,
  BiVatOverview,
  BiVatSummary,
  BiVatTrendRow,
} from "./vat-types";

/** App expense branch UUIDs → sales/VAT HQ|SYP codes. */
export const INCOME_STATEMENT_BRANCH_UUID: Record<"HQ" | "SYP", string> = {
  HQ: "c93efb5f-07c9-4229-b6b3-568ce1c0a9ab",
  SYP: "4975a5a1-90e6-443a-9921-c6c637f4631c",
};

const BRANCH_LABEL_TO_KEY: Record<string, "HQ" | "SYP"> = {
  สำนักงานใหญ่: "HQ",
  สี่แยกพัฒนา: "SYP",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function marginPct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Build P&L lines from VAT-book sales/purchase + company (ENTRIES) expense.
 * income_tax = max(0, profit) × CIT (losses → 0 tax).
 */
export function computeIncomeStatementLines(
  revenue: number,
  purchaseCost: number,
  expense: number,
  citRate: number = INCOME_STATEMENT_CIT_RATE,
  counts?: {
    sales_bill_count?: number;
    purchase_bill_count?: number;
    expense_bill_count?: number;
  }
): BiIncomeStatementSummary {
  const total_cost = round2(purchaseCost + expense);
  const profit_before_tax = round2(revenue - total_cost);
  const income_tax = round2(Math.max(0, profit_before_tax) * citRate);
  const net_profit = round2(profit_before_tax - income_tax);

  return {
    revenue: round2(revenue),
    purchase_cost: round2(purchaseCost),
    expense: round2(expense),
    total_cost,
    profit_before_tax,
    profit_margin_pct: marginPct(profit_before_tax, revenue),
    income_tax,
    cit_rate: citRate,
    net_profit,
    net_margin_pct: marginPct(net_profit, revenue),
    sales_bill_count: counts?.sales_bill_count ?? 0,
    purchase_bill_count: counts?.purchase_bill_count ?? 0,
    expense_bill_count: counts?.expense_bill_count ?? 0,
  };
}

function summaryFromParts(
  vat: BiVatSummary,
  companyExpense: number,
  expenseBillCount: number,
  citRate: number
): BiIncomeStatementSummary {
  return computeIncomeStatementLines(
    vat.sales_before,
    vat.purchase_before,
    companyExpense,
    citRate,
    {
      sales_bill_count: vat.sales_bill_count,
      purchase_bill_count: vat.purchase_bill_count,
      expense_bill_count: expenseBillCount,
    }
  );
}

function forecastFromParts(
  forecast: BiVatForecast,
  companyExpense: number,
  citRate: number
): BiIncomeStatementForecast {
  const factor = forecast.factor || 1;
  const lines = computeIncomeStatementLines(
    forecast.sales_before,
    forecast.purchase_before,
    companyExpense * factor,
    citRate
  );

  return {
    enabled: forecast.enabled,
    as_of: forecast.as_of,
    days_elapsed: forecast.days_elapsed,
    days_in_range: forecast.days_in_range,
    factor: forecast.factor,
    revenue: lines.revenue,
    purchase_cost: lines.purchase_cost,
    expense: lines.expense,
    total_cost: lines.total_cost,
    profit_before_tax: lines.profit_before_tax,
    income_tax: lines.income_tax,
    net_profit: lines.net_profit,
  };
}

export function mapExpenseBranchToKey(
  key: string,
  label?: string
): "HQ" | "SYP" | null {
  if (key === INCOME_STATEMENT_BRANCH_UUID.HQ) return "HQ";
  if (key === INCOME_STATEMENT_BRANCH_UUID.SYP) return "SYP";
  if (label && BRANCH_LABEL_TO_KEY[label]) return BRANCH_LABEL_TO_KEY[label];
  return null;
}

function companyExpenseByBranch(
  expense: BiExpenseOverview
): Record<"HQ" | "SYP", { amount: number; line_count: number }> {
  const out: Record<"HQ" | "SYP", { amount: number; line_count: number }> = {
    HQ: { amount: 0, line_count: 0 },
    SYP: { amount: 0, line_count: 0 },
  };
  for (const row of expense.by_branch) {
    const code = mapExpenseBranchToKey(row.key, row.label);
    if (!code) continue;
    out[code].amount = round2(out[code].amount + row.amount);
    out[code].line_count += row.line_count;
  }
  return out;
}

function branchRows(
  vatBranches: BiVatBranchRow[],
  expense: BiExpenseOverview,
  citRate: number
): BiIncomeStatementBranchRow[] {
  const expByBranch = companyExpenseByBranch(expense);
  return vatBranches.map((row) => {
    const key = row.key === "SYP" ? "SYP" : "HQ";
    const company = expByBranch[key];
    const lines = computeIncomeStatementLines(
      row.sales_before,
      row.purchase_before,
      company.amount,
      citRate
    );
    return {
      key: row.key,
      revenue: lines.revenue,
      purchase_cost: lines.purchase_cost,
      expense: lines.expense,
      total_cost: lines.total_cost,
      profit_before_tax: lines.profit_before_tax,
      income_tax: lines.income_tax,
      net_profit: lines.net_profit,
    };
  });
}

function monthlyExpenseMap(
  rows: BiExpenseTrendRow[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.period, round2(row.entries_amount || row.amount));
  }
  return map;
}

/**
 * Build trend from VAT sales/purchase + company ENTRIES expense.
 * Monthly expense comes from expense BI; daily expense is allocated evenly
 * across days in the same month that fall on/before as_of.
 */
export function buildTrendRows(
  vatRows: BiVatTrendRow[],
  monthlyCompanyExpense: Map<string, number>,
  options: {
    mode: "daily" | "monthly";
    asOf?: string;
    citRate?: number;
  }
): BiIncomeStatementTrendRow[] {
  const citRate = options.citRate ?? INCOME_STATEMENT_CIT_RATE;
  const asOf = options.asOf;

  const dailyExpenseByPeriod = new Map<string, number>();
  if (options.mode === "daily") {
    const daysByMonth = new Map<string, string[]>();
    for (const row of vatRows) {
      if (asOf && row.period > asOf) continue;
      const month = row.period.slice(0, 7);
      const list = daysByMonth.get(month) ?? [];
      list.push(row.period);
      daysByMonth.set(month, list);
    }
    for (const [month, days] of daysByMonth) {
      const total = monthlyCompanyExpense.get(month) ?? 0;
      if (days.length === 0) continue;
      const each = total / days.length;
      for (const day of days) {
        dailyExpenseByPeriod.set(day, round2(each));
      }
    }
  }

  return vatRows.map((row) => {
    const revenue = round2(row.sales_vat / 0.07);
    const purchase_cost = round2(row.purchase_vat / 0.07);
    const expense =
      options.mode === "monthly"
        ? monthlyCompanyExpense.get(row.period) ?? 0
        : dailyExpenseByPeriod.get(row.period) ?? 0;
    const lines = computeIncomeStatementLines(
      revenue,
      purchase_cost,
      expense,
      citRate
    );
    return {
      period: row.period,
      revenue: lines.revenue,
      purchase_cost: lines.purchase_cost,
      expense: lines.expense,
      total_cost: lines.total_cost,
      profit_before_tax: lines.profit_before_tax,
      income_tax: lines.income_tax,
      net_profit: lines.net_profit,
    };
  });
}

export type DeriveIncomeStatementInput = {
  vat: BiVatOverview;
  /** Company (ENTRIES) expense overview for the same date range / branch. */
  companyExpense: BiExpenseOverview;
  citRate?: number;
};

/** Derive income-statement overview from VAT books + company ENTRIES expense. */
export function deriveIncomeStatement({
  vat,
  companyExpense,
  citRate = INCOME_STATEMENT_CIT_RATE,
}: DeriveIncomeStatementInput): BiIncomeStatementOverview {
  const expenseAmount = companyExpense.summary.entries_amount;
  const expenseCount =
    companyExpense.summary.receipt_count || companyExpense.summary.line_count;
  const previousExpenseAmount = companyExpense.previous_summary.amount;
  const monthlyExpense = monthlyExpenseMap(companyExpense.trend_monthly);

  return {
    from: vat.from,
    to: vat.to,
    branch: vat.branch,
    previous_from: vat.previous_from,
    previous_to: vat.previous_to,
    as_of: vat.as_of,
    cit_rate: citRate,
    summary: summaryFromParts(vat.summary, expenseAmount, expenseCount, citRate),
    previous_summary: summaryFromParts(
      vat.previous_summary,
      previousExpenseAmount,
      companyExpense.previous_summary.line_count,
      citRate
    ),
    forecast: forecastFromParts(vat.forecast, expenseAmount, citRate),
    by_branch: branchRows(vat.by_branch, companyExpense, citRate),
    trend_daily: buildTrendRows(vat.trend_daily, monthlyExpense, {
      mode: "daily",
      asOf: vat.as_of,
      citRate,
    }),
    trend_monthly: buildTrendRows(vat.trend_monthly, monthlyExpense, {
      mode: "monthly",
      citRate,
    }),
  };
}

/** @deprecated use deriveIncomeStatement — kept for older call sites/tests */
export function deriveIncomeStatementFromVat(
  vat: BiVatOverview,
  citRate: number = INCOME_STATEMENT_CIT_RATE
): BiIncomeStatementOverview {
  const emptyExpense: BiExpenseOverview = {
    from: vat.from,
    to: vat.to,
    branch: null,
    source: "ENTRIES",
    limit: 0,
    previous_from: vat.previous_from,
    previous_to: vat.previous_to,
    summary: {
      amount: vat.summary.expense_before,
      line_count: vat.summary.expense_bill_count,
      item_count: 0,
      receipt_count: vat.summary.expense_bill_count,
      general_count: 0,
      entries_amount: vat.summary.expense_before,
      general_amount: 0,
    },
    previous_summary: {
      amount: vat.previous_summary.expense_before,
      line_count: vat.previous_summary.expense_bill_count,
      item_count: 0,
    },
    by_source: [],
    by_branch: [],
    by_category: [],
    top_items: [],
    trend_monthly: [],
    month_columns: [],
    by_item_month: [],
    branches: [],
  };
  return deriveIncomeStatement({ vat, companyExpense: emptyExpense, citRate });
}

export function trendRowFromVat(
  row: BiVatTrendRow,
  citRate: number = INCOME_STATEMENT_CIT_RATE
): BiIncomeStatementTrendRow {
  return buildTrendRows([row], new Map([[row.period, round2(row.expense_vat / 0.07)]]), {
    mode: "monthly",
    citRate,
  })[0]!;
}
