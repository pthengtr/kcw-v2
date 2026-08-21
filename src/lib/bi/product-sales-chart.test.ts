import { describe, expect, it } from "vitest";

import {
  buildProductSalesPriceSeries,
  isBranchMixPieApplicable,
  marginPctFromGpAndCogs,
  purchasePeriodKey,
} from "./product-sales-chart";
import type {
  BiProductPurchaseHistoryRow,
  BiProductSalesTrendRow,
} from "./product-sales-types";

function trend(
  partial: Partial<BiProductSalesTrendRow> & { period: string }
): BiProductSalesTrendRow {
  return {
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
    ...partial,
  };
}

function buy(
  partial: Partial<BiProductPurchaseHistoryRow> & { bill_date: string }
): BiProductPurchaseHistoryRow {
  return {
    bill_no: "P1",
    billtype: "1",
    detail: "",
    acctno: null,
    base_qty: 0,
    unit_price: 0,
    amount_net: 0,
    ...partial,
  };
}

describe("purchasePeriodKey", () => {
  it("keeps the day or rolls up to YYYY-MM", () => {
    expect(purchasePeriodKey("2026-08-08", "daily")).toBe("2026-08-08");
    expect(purchasePeriodKey("2026-08-08T00:00:00", "monthly")).toBe(
      "2026-08"
    );
  });
});

describe("marginPctFromGpAndCogs", () => {
  it("uses GP / (GP + COGS) and skips empty costed revenue", () => {
    expect(marginPctFromGpAndCogs(40, 160)).toBeCloseTo(20);
    expect(marginPctFromGpAndCogs(0, 0)).toBeNull();
  });
});

describe("isBranchMixPieApplicable", () => {
  it("hides the pie for a single-branch filter or a one-slice mix", () => {
    expect(
      isBranchMixPieApplicable("HQ", [
        { revenue_net: 100 },
        { revenue_net: 50 },
      ])
    ).toBe(false);
    expect(
      isBranchMixPieApplicable("ALL", [
        { revenue_net: 100 },
        { revenue_net: 0 },
      ])
    ).toBe(false);
    expect(
      isBranchMixPieApplicable(null, [
        { revenue_net: 100 },
        { revenue_net: 50 },
      ])
    ).toBe(true);
  });
});

describe("buildProductSalesPriceSeries", () => {
  it("computes unit sale, unit COGS, margin, and overlays HQ buys", () => {
    const series = buildProductSalesPriceSeries(
      [
        trend({
          period: "2026-08-05",
          revenue_net: 280,
          base_qty: 2,
          cogs: 197,
          gross_profit: 83,
        }),
        trend({
          period: "2026-08-08",
          revenue_net: 140,
          base_qty: 1,
          cogs: 98.5,
          gross_profit: 41.5,
        }),
      ],
      [
        buy({
          bill_date: "2026-08-08",
          base_qty: 120,
          amount_net: 11820,
        }),
      ],
      "daily"
    );

    expect(series).toHaveLength(2);
    expect(series[0]?.avg_sale).toBeCloseTo(140);
    expect(series[0]?.avg_cost).toBeCloseTo(98.5);
    expect(series[0]?.avg_buy).toBeNull();
    expect(series[1]?.avg_buy).toBeCloseTo(98.5);
    expect(series[1]?.buy_qty).toBe(120);
    expect(series[1]?.margin_pct).toBeCloseTo(29.64, 1);
  });

  it("keeps purchase-only days so buy price still plots", () => {
    const series = buildProductSalesPriceSeries(
      [
        trend({
          period: "2026-08-01",
          revenue_net: 140,
          base_qty: 1,
          cogs: 100,
          gross_profit: 40,
        }),
      ],
      [buy({ bill_date: "2026-08-10", base_qty: 10, amount_net: 900 })],
      "daily"
    );
    expect(series.map((p) => p.period)).toEqual([
      "2026-08-01",
      "2026-08-10",
    ]);
    expect(series[1]?.avg_sale).toBeNull();
    expect(series[1]?.avg_buy).toBeCloseTo(90);
  });

  it("rolls purchases into the month bucket", () => {
    const series = buildProductSalesPriceSeries(
      [
        trend({
          period: "2026-08",
          revenue_net: 6291,
          base_qty: 45,
          cogs: 4639,
          gross_profit: 1652,
        }),
      ],
      [
        buy({ bill_date: "2026-08-08", base_qty: 60, amount_net: 5910 }),
        buy({ bill_date: "2026-08-20", base_qty: 60, amount_net: 5910 }),
      ],
      "monthly"
    );
    expect(series).toHaveLength(1);
    expect(series[0]?.avg_sale).toBeCloseTo(139.8, 1);
    expect(series[0]?.avg_buy).toBeCloseTo(98.5);
    expect(series[0]?.buy_qty).toBe(120);
  });
});
