import {
  INCOME_STATEMENT_CIT_RATE,
  type BiIncomeStatementBranchRow,
  type BiIncomeStatementForecast,
  type BiIncomeStatementOverview,
  type BiIncomeStatementSummary,
  type BiIncomeStatementTrendRow,
} from "./income-statement-types";
import type {
  BiVatBranchRow,
  BiVatForecast,
  BiVatOverview,
  BiVatSummary,
  BiVatTrendRow,
} from "./vat-types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function marginPct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Build P&L lines from VAT-book before-tax bases.
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

function summaryFromVat(
  vat: BiVatSummary,
  citRate: number
): BiIncomeStatementSummary {
  return computeIncomeStatementLines(
    vat.sales_before,
    vat.purchase_before,
    vat.expense_before,
    citRate,
    {
      sales_bill_count: vat.sales_bill_count,
      purchase_bill_count: vat.purchase_bill_count,
      expense_bill_count: vat.expense_bill_count,
    }
  );
}

function forecastFromVat(
  forecast: BiVatForecast,
  citRate: number
): BiIncomeStatementForecast {
  const lines = computeIncomeStatementLines(
    forecast.sales_before,
    forecast.purchase_before,
    forecast.expense_before,
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

function branchFromVat(
  row: BiVatBranchRow,
  citRate: number
): BiIncomeStatementBranchRow {
  const lines = computeIncomeStatementLines(
    row.sales_before,
    row.purchase_before,
    row.expense_before,
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
}

/**
 * Trend rows only carry VAT amounts. Recover before-tax base as vat / 0.07
 * (matches expense VAT math; close for sales/purchase tax books).
 */
export function trendRowFromVat(
  row: BiVatTrendRow,
  citRate: number = INCOME_STATEMENT_CIT_RATE
): BiIncomeStatementTrendRow {
  const revenue = round2(row.sales_vat / 0.07);
  const purchase_cost = round2(row.purchase_vat / 0.07);
  const expense = round2(row.expense_vat / 0.07);
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
}

/** Derive income-statement overview from VAT tax-book overview. */
export function deriveIncomeStatementFromVat(
  vat: BiVatOverview,
  citRate: number = INCOME_STATEMENT_CIT_RATE
): BiIncomeStatementOverview {
  return {
    from: vat.from,
    to: vat.to,
    branch: vat.branch,
    previous_from: vat.previous_from,
    previous_to: vat.previous_to,
    as_of: vat.as_of,
    cit_rate: citRate,
    summary: summaryFromVat(vat.summary, citRate),
    previous_summary: summaryFromVat(vat.previous_summary, citRate),
    forecast: forecastFromVat(vat.forecast, citRate),
    by_branch: vat.by_branch.map((r) => branchFromVat(r, citRate)),
    trend_daily: vat.trend_daily.map((r) => trendRowFromVat(r, citRate)),
    trend_monthly: vat.trend_monthly.map((r) => trendRowFromVat(r, citRate)),
  };
}
