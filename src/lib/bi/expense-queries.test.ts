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
        general_offset_amount: 0,
        general_offset_count: 0,
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
          entries_amount: 100_000,
          general_amount: 20_000,
          offset_amount: 0,
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
          offset_amount: 0,
        },
      ],
      trend_monthly: [
        {
          period: "2026-07",
          amount: 500_000,
          line_count: 120,
          entries_amount: 300_000,
          general_amount: 200_000,
          offset_amount: 0,
        },
      ],
      month_columns: ["2026-01", "2026-07"],
      by_item_month: [
        {
          key: "item-1",
          label: "ค่าไฟ",
          category_name: "สาธารณูปโภค",
          total: 90_000,
          months: { "2026-01": 10_000, "2026-07": 80_000 },
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
    expect(overview.summary.general_offset_amount).toBe(0);
    expect(overview.top_items[0]?.offset_amount).toBe(0);
    expect(overview.by_category[0]?.label).toBe("สาธารณูปโภค");
    expect(overview.top_items[0]?.label).toBe("ค่าไฟ");
    expect(overview.trend_monthly[0]?.period).toBe("2026-07");
    expect(overview.month_columns).toEqual(["2026-01", "2026-07"]);
    expect(overview.by_item_month[0]?.months["2026-07"]).toBe(80_000);
    expect(overview.branches).toHaveLength(1);
  });

  it("parses personal offset splits", () => {
    const overview = normalizeExpenseOverview({
      summary: {
        amount: 450_000,
        entries_amount: 300_000,
        general_amount: 150_000,
        general_offset_amount: -50_000,
        general_offset_count: 3,
      },
      by_source: [
        { key: "ENTRIES", amount: 300_000, line_count: 40 },
        { key: "GENERAL", amount: 200_000, line_count: 77 },
        { key: "OFFSET", amount: -50_000, line_count: 3 },
      ],
      by_category: [
        {
          key: "off",
          label: "หักส่วนตัวจากบิลบริษัท",
          amount: -50_000,
          offset_amount: -50_000,
        },
      ],
      top_items: [
        {
          key: "off-item",
          label: "หักส่วนตัวจากบิลบริษัท",
          offset_amount: -50_000,
        },
      ],
    });
    expect(overview.summary.general_offset_amount).toBe(-50_000);
    expect(overview.summary.general_offset_count).toBe(3);
    expect(overview.by_source.map((r) => r.key)).toEqual([
      "ENTRIES",
      "GENERAL",
      "OFFSET",
    ]);
    expect(overview.by_category[0]?.offset_amount).toBe(-50_000);
    expect(overview.top_items[0]?.offset_amount).toBe(-50_000);
  });
});
