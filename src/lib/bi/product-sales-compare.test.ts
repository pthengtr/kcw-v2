import { describe, expect, it } from "vitest";

import {
  buildCompareRevenueSeries,
  pickFocusedBcode,
  skuMixSlices,
  summarizeProductSalesReports,
  toCompareRow,
} from "./product-sales-compare";
import type {
  BiProductSalesIdentity,
  BiProductSalesOverview,
  BiProductSalesSummary,
} from "./product-sales-types";

function identity(
  partial: Partial<BiProductSalesIdentity> & { bcode: string }
): BiProductSalesIdentity {
  return {
    detail: partial.bcode,
    category_code: "22",
    category_name: "น้ำมัน",
    code1: null,
    code1_name: null,
    brand: null,
    model: null,
    pcode: null,
    mcode: null,
    on_hand_qty: 0,
    costlast: null,
    last_sale_date: null,
    last_purchase_date: null,
    ...partial,
  };
}

function summary(
  partial: Partial<BiProductSalesSummary>
): BiProductSalesSummary {
  return {
    revenue_net: 0,
    base_qty: 0,
    line_count: 0,
    bill_count: 0,
    avg_unit_price: 0,
    cogs: 0,
    costed_revenue_net: 0,
    gross_profit: 0,
    gross_margin_pct: null,
    blank_cost_line_count: 0,
    hq_revenue_net: 0,
    syp_revenue_net: 0,
    online_revenue_net: 0,
    hq_qty: 0,
    syp_qty: 0,
    online_qty: 0,
    ...partial,
  };
}

function overview(
  partial: Partial<BiProductSalesOverview> & { bcode: string }
): BiProductSalesOverview {
  return {
    from: "2026-08-01",
    to: "2026-08-18",
    branch: null,
    previous_from: "2026-07-14",
    previous_to: "2026-07-31",
    product: identity({ bcode: partial.bcode }),
    summary: summary({}),
    previous_summary: {
      revenue_net: 0,
      base_qty: 0,
      line_count: 0,
      cogs: 0,
      gross_profit: 0,
    },
    purchase: {
      buy_qty: 0,
      buy_amount_net: 0,
      buy_bills: 0,
      avg_unit_cost: 0,
    },
    by_branch: [],
    trend_daily: [],
    trend_monthly: [],
    sales_history: [],
    purchase_history: [],
    ...partial,
  };
}

describe("toCompareRow + summarizeProductSalesReports", () => {
  it("sums KPIs and uses costed revenue for combined margin", () => {
    const a = overview({
      bcode: "A",
      product: identity({ bcode: "A", detail: "ATF", on_hand_qty: 10 }),
      summary: summary({
        revenue_net: 1000,
        base_qty: 10,
        costed_revenue_net: 800,
        gross_profit: 200,
        gross_margin_pct: 25,
        hq_revenue_net: 600,
        syp_revenue_net: 400,
      }),
      previous_summary: {
        revenue_net: 500,
        base_qty: 5,
        line_count: 5,
        cogs: 300,
        gross_profit: 100,
      },
      purchase: {
        buy_qty: 4,
        buy_amount_net: 200,
        buy_bills: 1,
        avg_unit_cost: 50,
      },
      by_branch: [
        {
          key: "HQ",
          revenue_net: 600,
          base_qty: 6,
          bill_count: 3,
          cogs: 400,
          gross_profit: 120,
        },
        {
          key: "SYP",
          revenue_net: 400,
          base_qty: 4,
          bill_count: 2,
          cogs: 200,
          gross_profit: 80,
        },
      ],
    });
    const b = overview({
      bcode: "B",
      product: identity({ bcode: "B", detail: "15W40", on_hand_qty: 3 }),
      summary: summary({
        revenue_net: 0,
        costed_revenue_net: 200,
        gross_profit: 40,
      }),
    });

    const row = toCompareRow(a);
    expect(row.hq_revenue_net).toBe(600);
    expect(row.syp_revenue_net).toBe(400);
    expect(row.hq_qty).toBe(6);
    expect(row.syp_qty).toBe(4);
    expect(row.online_qty).toBe(0);
    expect(row.buy_qty).toBe(4);

    const totals = summarizeProductSalesReports([a, b]);
    expect(totals.skuCount).toBe(2);
    expect(totals.soldSkuCount).toBe(1);
    expect(totals.revenue_net).toBe(1000);
    expect(totals.previous_revenue_net).toBe(500);
    expect(totals.on_hand_qty).toBe(13);
    expect(totals.gross_margin_pct).toBeCloseTo(24);
  });

  it("falls back to summary qty when a branch row is missing", () => {
    const row = toCompareRow(
      overview({
        bcode: "C",
        product: identity({ bcode: "C" }),
        summary: summary({
          hq_qty: 12,
          syp_qty: 3,
          online_qty: 1,
        }),
      })
    );
    expect(row.hq_qty).toBe(12);
    expect(row.syp_qty).toBe(3);
    expect(row.online_qty).toBe(1);
  });
});

describe("pickFocusedBcode", () => {
  it("keeps the preferred SKU, else the highest revenue", () => {
    const reports = [
      overview({
        bcode: "LOW",
        product: identity({ bcode: "LOW" }),
        summary: summary({ revenue_net: 10 }),
      }),
      overview({
        bcode: "HIGH",
        product: identity({ bcode: "HIGH" }),
        summary: summary({ revenue_net: 90 }),
      }),
    ];
    expect(pickFocusedBcode(reports, "LOW")).toBe("LOW");
    expect(pickFocusedBcode(reports, "GONE")).toBe("HIGH");
    expect(pickFocusedBcode(reports, null)).toBe("HIGH");
  });
});

describe("buildCompareRevenueSeries + skuMixSlices", () => {
  it("aligns periods and drops zero-revenue SKUs from the pie", () => {
    const a = overview({
      bcode: "A",
      product: identity({ bcode: "A", detail: "ATF" }),
      summary: summary({ revenue_net: 100, base_qty: 2 }),
      trend_monthly: [
        {
          period: "2026-07",
          revenue_net: 40,
          base_qty: 1,
          bill_count: 1,
          hq_revenue_net: 40,
          syp_revenue_net: 0,
          online_revenue_net: 0,
          hq_qty: 1,
          syp_qty: 0,
          online_qty: 0,
          cogs: 20,
          gross_profit: 20,
        },
        {
          period: "2026-08",
          revenue_net: 60,
          base_qty: 1,
          bill_count: 1,
          hq_revenue_net: 60,
          syp_revenue_net: 0,
          online_revenue_net: 0,
          hq_qty: 1,
          syp_qty: 0,
          online_qty: 0,
          cogs: 30,
          gross_profit: 30,
        },
      ],
    });
    const b = overview({
      bcode: "B",
      product: identity({ bcode: "B" }),
      summary: summary({ revenue_net: 0 }),
      trend_monthly: [
        {
          period: "2026-08",
          revenue_net: 0,
          base_qty: 0,
          bill_count: 0,
          hq_revenue_net: 0,
          syp_revenue_net: 0,
          online_revenue_net: 0,
          hq_qty: 0,
          syp_qty: 0,
          online_qty: 0,
          cogs: 0,
          gross_profit: 0,
        },
      ],
    });

    expect(buildCompareRevenueSeries([a, b], "monthly")).toEqual([
      { period: "2026-07", A: 40, B: 0 },
      { period: "2026-08", A: 60, B: 0 },
    ]);

    const slices = skuMixSlices([toCompareRow(a), toCompareRow(b)]);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.key).toBe("A");
    expect(slices[0]?.share).toBe(100);
  });
});
