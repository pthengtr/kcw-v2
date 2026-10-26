import { describe, expect, it } from "vitest";

import { normalizeSalesOverview } from "./sales-queries";

describe("normalizeSalesOverview", () => {
  it("parses HQ/SYP/online trend splits", () => {
    const overview = normalizeSalesOverview({
      from: "2026-07-01",
      to: "2026-07-01",
      branch: null,
      previous_from: "2026-06-30",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 100,
        vat_baht: 7,
        bill_count: 2,
        avg_bill: 50,
      },
      previous_summary: { revenue_net: 80, vat_baht: 5, bill_count: 1 },
      by_sales_type: [],
      by_branch: [],
      by_channel: [],
      by_billtype: [],
      trend_daily: [
        {
          period: "2026-07-01",
          revenue_net: 100,
          bill_count: 2,
          hq_revenue_net: 70,
          syp_revenue_net: 30,
          online_revenue_net: 20,
        },
      ],
      trend_monthly: [],
    });

    expect(overview.trend_daily[0]).toMatchObject({
      hq_revenue_net: 70,
      syp_revenue_net: 30,
      online_revenue_net: 20,
    });
    expect(overview.online_margin.bill_count).toBe(0);
    expect(overview.online_margin.by_fee).toEqual([]);
  });

  it("parses online fee and FIFO margin", () => {
    const overview = normalizeSalesOverview({
      summary: {},
      previous_summary: {},
      online_margin: {
        revenue_net: "1000.50",
        fee_baht: 120,
        fifo_ext_cost: 400,
        profit: 480.5,
        margin_pct: "48.05",
        bill_count: 4,
        fee_bill_count: 3,
        fifo_bill_count: 4,
        fifo_partial_bill_count: 1,
        fifo_missing_bill_count: 0,
        by_platform: [
          {
            platform: "shopee",
            revenue_net: 1000.5,
            fee_baht: 120,
            fifo_ext_cost: 400,
            profit: 480.5,
            bill_count: 4,
          },
        ],
        by_fee: [{ fee_name: "ค่าคอมมิชชั่น", fee_baht: 80 }],
        trend_daily: [
          {
            period: "2026-10-01",
            revenue_net: 1000.5,
            fee_baht: 120,
            fifo_ext_cost: 400,
            profit: 480.5,
            bill_count: 4,
          },
        ],
        trend_monthly: [],
      },
      previous_online_margin: {
        revenue_net: 900,
        fee_baht: 100,
        fifo_ext_cost: 300,
        profit: 500,
        margin_pct: null,
        bill_count: 3,
      },
    });

    expect(overview.online_margin).toMatchObject({
      revenue_net: 1000.5,
      fee_baht: 120,
      fifo_ext_cost: 400,
      profit: 480.5,
      margin_pct: 48.05,
      fee_bill_count: 3,
      fifo_partial_bill_count: 1,
    });
    expect(overview.online_margin.by_platform[0]?.platform).toBe("shopee");
    expect(overview.online_margin.by_fee[0]?.fee_name).toBe("ค่าคอมมิชชั่น");
    expect(overview.online_margin.trend_daily[0]?.profit).toBe(480.5);
    expect(overview.previous_online_margin.profit).toBe(500);
    expect(overview.previous_online_margin.margin_pct).toBeNull();
  });
});
