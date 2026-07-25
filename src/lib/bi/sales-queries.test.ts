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
  });
});
