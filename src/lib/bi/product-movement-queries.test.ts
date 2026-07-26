import { describe, expect, it } from "vitest";

import { normalizeProductMovement } from "./product-movement-queries";

describe("normalizeProductMovement", () => {
  it("parses stock-more and dead-stock with category labels", () => {
    const overview = normalizeProductMovement({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      stock_limit: 50,
      dead_limit: 200,
      summary: {
        sold_sku_count: 100,
        sell_qty: 5000,
        bought_sku_count: 80,
        buy_qty: 4000,
        dead_yellow_count: 10,
        dead_orange_count: 5,
        dead_red_count: 2,
        dead_total_count: 17,
      },
      stock_more: [
        {
          bcode: "1500123",
          detail: "BEARING",
          category_code: "15",
          category_name: "15",
          code1: "I",
          code1_name: "I",
          sell_qty: 120,
          sell_bills: 40,
          sell_days: 20,
          buy_qty: 50,
          buy_bills: 3,
          on_hand_qty: 10,
          last_sale_date: "2026-07-20",
          last_purchase_date: "2026-06-01",
        },
      ],
      dead_stock: [
        {
          bcode: "2500999",
          detail: "ORING",
          category_code: "25",
          code1: "O",
          on_hand_qty: 30,
          last_purchase_date: "2025-01-01",
          last_sale_date: null,
          days_since_purchase: 571,
          days_since_sale: null,
          no_move_since_purchase: true,
          dead_tier: "red",
          sell_qty_period: 0,
          buy_qty_period: 0,
        },
      ],
    });

    expect(overview.stock_more[0]?.category_name).toContain("ลูกปืน");
    expect(overview.stock_more[0]?.code1_name).toContain("ลูกปืน");
    expect(overview.dead_stock[0]?.dead_tier).toBe("red");
    expect(overview.summary.dead_total_count).toBe(17);
  });
});
