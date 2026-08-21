import { describe, expect, it } from "vitest";

import {
  normalizeProductSales,
  normalizeProductSearch,
} from "./product-sales-queries";

describe("normalizeProductSearch", () => {
  it("parses ICMAS picker rows", () => {
    const hits = normalizeProductSearch({
      products: [
        {
          bcode: "22010574",
          detail: "น.ม.พ.ATF",
          brand: "STATES",
          model: "1LT",
          pcode: null,
          mcode: "8852694204774",
          category_code: "22",
          on_hand_qty: 112,
        },
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      bcode: "22010574",
      brand: "STATES",
      on_hand_qty: 112,
    });
  });
});

describe("normalizeProductSales", () => {
  it("parses identity, branch split, margin, and history", () => {
    const overview = normalizeProductSales({
      from: "2026-07-01",
      to: "2026-07-31",
      branch: null,
      bcode: "22010574",
      previous_from: "2026-05-31",
      previous_to: "2026-06-30",
      product: {
        bcode: "22010574",
        detail: "น.ม.พ.ATF",
        category_code: "22",
        code1: "P",
        brand: "STATES",
        model: "1LT",
        pcode: null,
        mcode: "885",
        on_hand_qty: 112,
        costlast: 98.5,
        last_sale_date: "2026-07-31",
        last_purchase_date: "2026-07-17",
      },
      summary: {
        revenue_net: 19768,
        base_qty: 154,
        line_count: 90,
        bill_count: 90,
        avg_unit_price: 128.36,
        cogs: 15966,
        costed_revenue_net: 19768,
        gross_profit: 3802,
        gross_margin_pct: 19.2,
        blank_cost_line_count: 0,
        hq_revenue_net: 15478,
        syp_revenue_net: 4290,
        online_revenue_net: 0,
        hq_qty: 122,
        syp_qty: 32,
        online_qty: 0,
      },
      previous_summary: {
        revenue_net: 18000,
        base_qty: 140,
        line_count: 80,
        cogs: 15000,
        gross_profit: 3000,
      },
      purchase: {
        buy_qty: 120,
        buy_amount_net: 12850,
        buy_bills: 1,
        avg_unit_cost: 107,
      },
      by_branch: [
        {
          key: "HQ",
          revenue_net: 15478,
          base_qty: 122,
          bill_count: 63,
          cogs: 12743,
          gross_profit: 2735,
        },
      ],
      trend_daily: [
        {
          period: "2026-07-01",
          revenue_net: 500,
          base_qty: 4,
          bill_count: 3,
          hq_revenue_net: 400,
          syp_revenue_net: 100,
          online_revenue_net: 0,
          hq_qty: 3,
          syp_qty: 1,
          online_qty: 0,
          cogs: 390,
          gross_profit: 110,
        },
      ],
      trend_monthly: [],
      sales_history: [
        {
          bill_date: "2026-07-31",
          reporting_branch: "HQ",
          store_branch: "HQ",
          bill_no: "K123",
          billtype: "UNKNOWN",
          base_qty: 2,
          revenue_net: 260,
          unit_cost: 98.5,
          cogs: 197,
          gross_profit: 63,
        },
      ],
      purchase_history: [
        {
          bill_date: "2026-07-17",
          bill_no: "PI1",
          billtype: "1",
          detail: "ATF",
          acctno: "V1",
          base_qty: 120,
          unit_price: 107,
          amount_net: 12850,
        },
      ],
    });

    expect(overview.product).toMatchObject({
      bcode: "22010574",
      category_name: "น้ำมัน จารบี น้ำยา",
      code1_name: "ไส้กรองน้ำมันเครื่อง",
      last_sale_date: "2026-07-31",
    });
    expect(overview.summary.gross_margin_pct).toBe(19.2);
    expect(overview.by_branch[0]?.revenue_net).toBe(15478);
    expect(overview.trend_daily[0]?.syp_qty).toBe(1);
    expect(overview.sales_history[0]?.bill_no).toBe("K123");
    expect(overview.purchase.buy_qty).toBe(120);
  });
});
