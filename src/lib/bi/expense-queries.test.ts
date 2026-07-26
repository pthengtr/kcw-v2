import { describe, expect, it } from "vitest";

import { normalizeExpenseOverview } from "./expense-queries";

describe("normalizeExpenseOverview", () => {
  it("parses summary, categories, items, and trend", () => {
    const overview = normalizeExpenseOverview({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      source: null,
      limit: 30,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        amount: 500_000,
        line_count: 120,
        item_count: 18,
        receipt_count: 40,
        general_count: 80,
        entries_amount: 300_000,
        general_amount: 200_000,
      },
      previous_summary: {
        amount: 450_000,
        line_count: 110,
        item_count: 16,
      },
      by_source: [
        { key: "ENTRIES", amount: 300_000, line_count: 40 },
        { key: "GENERAL", amount: 200_000, line_count: 80 },
      ],
      by_branch: [
        {
          key: "c93efb5f-07c9-4229-b6b3-568ce1c0a9ab",
          label: "สำนักงานใหญ่",
          amount: 480_000,
          line_count: 110,
        },
      ],
      by_category: [
        {
          key: "cat-1",
          label: "สาธารณูปโภค",
          amount: 120_000,
          item_count: 4,
          line_count: 20,
        },
      ],
      top_items: [
        {
          key: "item-1",
          label: "ค่าไฟ",
          category_name: "สาธารณูปโภค",
          amount: 80_000,
          line_count: 5,
          entries_amount: 70_000,
          general_amount: 10_000,
        },
      ],
      trend_monthly: [
        {
          period: "2026-07",
          amount: 500_000,
          line_count: 120,
          entries_amount: 300_000,
          general_amount: 200_000,
        },
      ],
      branches: [
        {
          key: "c93efb5f-07c9-4229-b6b3-568ce1c0a9ab",
          label: "สำนักงานใหญ่",
        },
      ],
    });

    expect(overview.summary.entries_amount).toBe(300_000);
    expect(overview.by_category[0]?.label).toBe("สาธารณูปโภค");
    expect(overview.top_items[0]?.label).toBe("ค่าไฟ");
    expect(overview.trend_monthly[0]?.period).toBe("2026-07");
    expect(overview.branches).toHaveLength(1);
  });
});
