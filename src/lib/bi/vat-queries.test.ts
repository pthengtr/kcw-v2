import { describe, expect, it } from "vitest";

import { normalizeVatOverview } from "./vat-queries";

describe("normalizeVatOverview", () => {
  it("parses summary, forecast, breakdowns, and trends", () => {
    const overview = normalizeVatOverview({
      from: "2026-08-01",
      to: "2026-08-31",
      branch: null,
      previous_from: "2026-07-01",
      previous_to: "2026-07-31",
      as_of: "2026-08-05",
      summary: {
        sales_before: 1_000_000,
        sales_vat: 70_000,
        sales_bill_count: 100,
        purchase_before: 500_000,
        purchase_vat: 35_000,
        purchase_bill_count: 40,
        expense_before: 100_000,
        expense_vat: 7_000,
        expense_bill_count: 10,
        net_vat: 28_000,
      },
      previous_summary: {
        sales_before: 900_000,
        sales_vat: 63_000,
        sales_bill_count: 90,
        purchase_before: 480_000,
        purchase_vat: 33_600,
        purchase_bill_count: 38,
        expense_before: 90_000,
        expense_vat: 6_300,
        expense_bill_count: 9,
        net_vat: 23_100,
      },
      forecast: {
        enabled: true,
        as_of: "2026-08-05",
        days_elapsed: 5,
        days_in_range: 31,
        factor: 6.2,
        sales_vat: 434_000,
        purchase_vat: 217_000,
        expense_vat: 43_400,
        net_vat: 173_600,
        sales_before: 6_200_000,
        purchase_before: 3_100_000,
        expense_before: 620_000,
      },
      by_sales_doc: [
        {
          key: "TAR",
          branch: "HQ",
          bill_count: 50,
          beforetax: 600_000,
          tax: 42_000,
          aftertax: 642_000,
        },
      ],
      by_purchase_book: [
        {
          key: "เครดิต",
          bill_count: 30,
          beforetax: 400_000,
          tax: 28_000,
          aftertax: 428_000,
        },
      ],
      by_expense_doc: [
        {
          key: "ค่าใช้จ่าย",
          branch: "HQ",
          bill_count: 10,
          beforetax: 100_000,
          tax: 7_000,
          aftertax: 107_000,
        },
      ],
      by_branch: [
        {
          key: "HQ",
          sales_vat: 60_000,
          sales_before: 850_000,
          purchase_vat: 35_000,
          purchase_before: 500_000,
          expense_vat: 5_000,
          expense_before: 70_000,
          net_vat: 20_000,
        },
      ],
      trend_daily: [
        {
          period: "2026-08-01",
          sales_vat: 10_000,
          purchase_vat: 5_000,
          expense_vat: 1_000,
          net_vat: 4_000,
        },
      ],
      trend_monthly: [
        {
          period: "2026-08",
          sales_vat: 70_000,
          purchase_vat: 35_000,
          expense_vat: 7_000,
          net_vat: 28_000,
        },
      ],
    });

    expect(overview.summary.net_vat).toBe(28_000);
    expect(overview.forecast.enabled).toBe(true);
    expect(overview.forecast.factor).toBe(6.2);
    expect(overview.by_sales_doc[0]?.key).toBe("TAR");
    expect(overview.by_purchase_book[0]?.key).toBe("เครดิต");
    expect(overview.trend_monthly).toHaveLength(1);
  });

  it("defaults missing fields safely", () => {
    const overview = normalizeVatOverview({});
    expect(overview.summary.sales_vat).toBe(0);
    expect(overview.forecast.enabled).toBe(false);
    expect(overview.by_sales_doc).toEqual([]);
    expect(overview.branch).toBeNull();
  });
});
