import { describe, expect, it } from "vitest";

import { normalizeProductOverview } from "./product-queries";

describe("normalizeProductOverview", () => {
  it("parses ranking rows and category groups", () => {
    const overview = normalizeProductOverview({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      limit: 50,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 1000,
        base_qty: 20,
        sku_count: 2,
        line_count: 3,
        bill_count: 2,
      },
      previous_summary: {
        revenue_net: 800,
        base_qty: 15,
        sku_count: 1,
      },
      by_category: [
        {
          key: "21",
          label: "แบตเตอรี่ น้ำกรด น้ำกลั่น",
          revenue_net: 700,
          base_qty: 10,
          sku_count: 1,
        },
      ],
      by_code1: [
        {
          key: "OTHER",
          label: "อื่นๆ / ไม่ระบุ",
          revenue_net: 1000,
          base_qty: 20,
          sku_count: 2,
        },
      ],
      by_branch: [{ key: "HQ", revenue_net: 1000, bill_count: 3 }],
      top_products: [
        {
          bcode: "21050289",
          detail: "แบตเตอรี่",
          category_code: "21",
          category_name: "แบตเตอรี่ น้ำกรด น้ำกลั่น",
          code1: null,
          code1_name: null,
          revenue_net: 700,
          base_qty: 10,
          line_count: 2,
          bill_count: 2,
          hq_revenue_net: 500,
          syp_revenue_net: 200,
          online_revenue_net: 0,
          on_hand_qty: 37,
          pcode: null,
          mcode: "1031026306",
          brand: "FB",
        },
      ],
    });

    expect(overview.summary.sku_count).toBe(2);
    expect(overview.category).toBeNull();
    expect(overview.bcodes).toBeNull();
    expect(overview.by_category[0]?.label).toContain("แบตเตอรี่");
    expect(overview.top_products[0]).toMatchObject({
      bcode: "21050289",
      hq_revenue_net: 500,
      on_hand_qty: 37,
    });
  });

  it("keeps category and custom bcode filters", () => {
    const overview = normalizeProductOverview({
      from: "2026-08-01",
      to: "2026-08-18",
      category: "12",
      bcodes: ["12010001", "12010002"],
      summary: { revenue_net: 10, base_qty: 1, sku_count: 2, line_count: 2, bill_count: 2 },
      previous_summary: { revenue_net: 8, base_qty: 1, sku_count: 1 },
    });
    expect(overview.category).toBe("12");
    expect(overview.bcodes).toEqual(["12010001", "12010002"]);
  });
});
