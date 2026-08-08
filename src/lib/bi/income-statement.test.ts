import { describe, expect, it } from "vitest";

import {
  computeIncomeStatementLines,
  deriveIncomeStatementFromVat,
  trendRowFromVat,
} from "./income-statement";
import { INCOME_STATEMENT_CIT_RATE } from "./income-statement-types";
import type { BiVatOverview } from "./vat-types";

const vatBase: BiVatOverview = {
  from: "2026-01-01",
  to: "2026-12-31",
  branch: null,
  previous_from: "2025-01-01",
  previous_to: "2025-12-31",
  as_of: "2026-08-08",
  summary: {
    sales_before: 10_000_000,
    sales_vat: 700_000,
    sales_bill_count: 500,
    purchase_before: 4_000_000,
    purchase_vat: 280_000,
    purchase_bill_count: 200,
    expense_before: 1_000_000,
    expense_vat: 70_000,
    expense_bill_count: 80,
    net_vat: 350_000,
  },
  previous_summary: {
    sales_before: 9_000_000,
    sales_vat: 630_000,
    sales_bill_count: 450,
    purchase_before: 3_800_000,
    purchase_vat: 266_000,
    purchase_bill_count: 180,
    expense_before: 900_000,
    expense_vat: 63_000,
    expense_bill_count: 70,
    net_vat: 301_000,
  },
  forecast: {
    enabled: true,
    as_of: "2026-08-08",
    days_elapsed: 220,
    days_in_range: 365,
    factor: 365 / 220,
    sales_vat: 700_000 * (365 / 220),
    purchase_vat: 280_000 * (365 / 220),
    expense_vat: 70_000 * (365 / 220),
    net_vat: 350_000 * (365 / 220),
    sales_before: 10_000_000 * (365 / 220),
    purchase_before: 4_000_000 * (365 / 220),
    expense_before: 1_000_000 * (365 / 220),
  },
  by_sales_doc: [],
  by_purchase_book: [],
  by_expense_doc: [],
  by_branch: [
    {
      key: "HQ",
      sales_vat: 500_000,
      sales_before: 7_000_000,
      purchase_vat: 280_000,
      purchase_before: 4_000_000,
      expense_vat: 50_000,
      expense_before: 700_000,
      net_vat: 170_000,
    },
    {
      key: "SYP",
      sales_vat: 200_000,
      sales_before: 3_000_000,
      purchase_vat: 0,
      purchase_before: 0,
      expense_vat: 20_000,
      expense_before: 300_000,
      net_vat: 180_000,
    },
  ],
  trend_daily: [
    {
      period: "2026-08-01",
      sales_vat: 7_000,
      purchase_vat: 2_800,
      expense_vat: 700,
      net_vat: 3_500,
    },
  ],
  trend_monthly: [
    {
      period: "2026-07",
      sales_vat: 70_000,
      purchase_vat: 28_000,
      expense_vat: 7_000,
      net_vat: 35_000,
    },
  ],
};

describe("computeIncomeStatementLines", () => {
  it("computes profit and 20% CIT on positive profit", () => {
    const lines = computeIncomeStatementLines(10_000_000, 4_000_000, 1_000_000);
    expect(lines.total_cost).toBe(5_000_000);
    expect(lines.profit_before_tax).toBe(5_000_000);
    expect(lines.income_tax).toBe(1_000_000);
    expect(lines.net_profit).toBe(4_000_000);
    expect(lines.cit_rate).toBe(INCOME_STATEMENT_CIT_RATE);
    expect(lines.profit_margin_pct).toBeCloseTo(50);
    expect(lines.net_margin_pct).toBeCloseTo(40);
  });

  it("charges zero tax on a loss", () => {
    const lines = computeIncomeStatementLines(1_000_000, 800_000, 500_000);
    expect(lines.profit_before_tax).toBe(-300_000);
    expect(lines.income_tax).toBe(0);
    expect(lines.net_profit).toBe(-300_000);
  });
});

describe("trendRowFromVat", () => {
  it("recovers before-tax bases as vat / 0.07", () => {
    const row = trendRowFromVat({
      period: "2026-07",
      sales_vat: 70_000,
      purchase_vat: 28_000,
      expense_vat: 7_000,
      net_vat: 35_000,
    });
    expect(row.revenue).toBe(1_000_000);
    expect(row.purchase_cost).toBe(400_000);
    expect(row.expense).toBe(100_000);
    expect(row.profit_before_tax).toBe(500_000);
    expect(row.income_tax).toBe(100_000);
    expect(row.net_profit).toBe(400_000);
  });
});

describe("deriveIncomeStatementFromVat", () => {
  it("maps VAT overview into income-statement shape", () => {
    const overview = deriveIncomeStatementFromVat(vatBase);
    expect(overview.summary.revenue).toBe(10_000_000);
    expect(overview.summary.purchase_cost).toBe(4_000_000);
    expect(overview.summary.expense).toBe(1_000_000);
    expect(overview.summary.profit_before_tax).toBe(5_000_000);
    expect(overview.summary.income_tax).toBe(1_000_000);
    expect(overview.summary.net_profit).toBe(4_000_000);
    expect(overview.forecast.enabled).toBe(true);
    expect(overview.forecast.profit_before_tax).toBeCloseTo(
      5_000_000 * (365 / 220),
      0
    );
    expect(overview.by_branch).toHaveLength(2);
    expect(overview.by_branch[0]?.key).toBe("HQ");
    expect(overview.trend_monthly[0]?.revenue).toBe(1_000_000);
    expect(overview.previous_summary.profit_before_tax).toBe(4_300_000);
  });
});
