import { describe, expect, it } from "vitest";

import type { BiExpenseOverview } from "./expense-types";
import {
  buildTrendRows,
  computeIncomeStatementLines,
  deriveIncomeStatement,
  mapExpenseBranchToKey,
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
    {
      period: "2026-08-02",
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
    {
      period: "2026-08",
      sales_vat: 70_000,
      purchase_vat: 28_000,
      expense_vat: 7_000,
      net_vat: 35_000,
    },
  ],
};

const companyExpense: BiExpenseOverview = {
  from: "2026-01-01",
  to: "2026-12-31",
  branch: null,
  source: "ENTRIES",
  limit: 5,
  previous_from: "2025-01-01",
  previous_to: "2025-12-31",
  summary: {
    amount: 6_800_000,
    line_count: 1000,
    item_count: 20,
    receipt_count: 990,
    general_count: 0,
    entries_amount: 6_800_000,
    general_amount: 0,
  },
  previous_summary: {
    amount: 6_000_000,
    line_count: 900,
    item_count: 18,
  },
  by_source: [],
  by_branch: [
    {
      key: "c93efb5f-07c9-4229-b6b3-568ce1c0a9ab",
      label: "สำนักงานใหญ่",
      amount: 6_000_000,
      line_count: 900,
    },
    {
      key: "4975a5a1-90e6-443a-9921-c6c637f4631c",
      label: "สี่แยกพัฒนา",
      amount: 800_000,
      line_count: 100,
    },
  ],
  by_category: [],
  top_items: [],
  trend_monthly: [
    {
      period: "2026-07",
      amount: 900_000,
      line_count: 120,
      entries_amount: 900_000,
      general_amount: 0,
    },
    {
      period: "2026-08",
      amount: 1_000_000,
      line_count: 130,
      entries_amount: 1_000_000,
      general_amount: 0,
    },
  ],
  month_columns: [],
  by_item_month: [],
  branches: [],
};

describe("computeIncomeStatementLines", () => {
  it("computes profit and 20% CIT on positive profit", () => {
    const lines = computeIncomeStatementLines(10_000_000, 4_000_000, 1_000_000);
    expect(lines.total_cost).toBe(5_000_000);
    expect(lines.profit_before_tax).toBe(5_000_000);
    expect(lines.income_tax).toBe(1_000_000);
    expect(lines.net_profit).toBe(4_000_000);
    expect(lines.cit_rate).toBe(INCOME_STATEMENT_CIT_RATE);
  });

  it("charges zero tax on a loss", () => {
    const lines = computeIncomeStatementLines(1_000_000, 800_000, 500_000);
    expect(lines.profit_before_tax).toBe(-300_000);
    expect(lines.income_tax).toBe(0);
    expect(lines.net_profit).toBe(-300_000);
  });
});

describe("mapExpenseBranchToKey", () => {
  it("maps HQ/SYP uuids and Thai labels", () => {
    expect(
      mapExpenseBranchToKey("c93efb5f-07c9-4229-b6b3-568ce1c0a9ab")
    ).toBe("HQ");
    expect(
      mapExpenseBranchToKey("4975a5a1-90e6-443a-9921-c6c637f4631c")
    ).toBe("SYP");
    expect(mapExpenseBranchToKey("x", "สำนักงานใหญ่")).toBe("HQ");
  });
});

describe("buildTrendRows", () => {
  it("uses company monthly expense instead of VAT expense base", () => {
    const rows = buildTrendRows(
      vatBase.trend_monthly,
      new Map([
        ["2026-07", 900_000],
        ["2026-08", 1_000_000],
      ]),
      { mode: "monthly" }
    );
    expect(rows[0]?.expense).toBe(900_000);
    expect(rows[1]?.expense).toBe(1_000_000);
    expect(rows[0]?.revenue).toBe(1_000_000);
  });

  it("allocates monthly company expense across elapsed daily rows", () => {
    const rows = buildTrendRows(
      vatBase.trend_daily,
      new Map([["2026-08", 1_000_000]]),
      { mode: "daily", asOf: "2026-08-08" }
    );
    expect(rows[0]?.expense).toBe(500_000);
    expect(rows[1]?.expense).toBe(500_000);
  });
});

describe("deriveIncomeStatement", () => {
  it("uses company ENTRIES expense (~6.8M) not VAT expense_before", () => {
    const overview = deriveIncomeStatement({
      vat: vatBase,
      companyExpense,
    });
    expect(overview.summary.expense).toBe(6_800_000);
    expect(overview.summary.expense).not.toBe(vatBase.summary.expense_before);
    expect(overview.summary.revenue).toBe(10_000_000);
    expect(overview.summary.purchase_cost).toBe(4_000_000);
    // 10M - 4M - 6.8M = -0.8M loss → tax 0
    expect(overview.summary.profit_before_tax).toBe(-800_000);
    expect(overview.summary.income_tax).toBe(0);
    expect(overview.summary.expense_bill_count).toBe(990);
    expect(overview.by_branch.find((b) => b.key === "HQ")?.expense).toBe(
      6_000_000
    );
    expect(overview.by_branch.find((b) => b.key === "SYP")?.expense).toBe(
      800_000
    );
    expect(overview.forecast.expense).toBeCloseTo(
      6_800_000 * (365 / 220),
      0
    );
    expect(overview.trend_monthly[0]?.expense).toBe(900_000);
  });
});
