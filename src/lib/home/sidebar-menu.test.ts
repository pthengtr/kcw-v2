import { describe, expect, it } from "vitest";

import {
  canAccessHomeMenuItem,
  isHomeMenuPathActive,
  matchesMenuSearch,
} from "@/lib/home/sidebar-menu";

describe("sidebar menu helpers", () => {
  it("filters protected menu items by page keys", () => {
    const pageKeys = ["po_status", "bi_income"];
    expect(canAccessHomeMenuItem("po", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("bi", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("tigerPay", pageKeys)).toBe(false);
    expect(canAccessHomeMenuItem("reminder", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("productImageKpi", pageKeys)).toBe(true);
  });

  it("matches menu search against label and description", () => {
    const item = {
      label: "เตือนโอน",
      description: "ติดตามรายการและกำหนดการโอนเงิน",
    };
    expect(matchesMenuSearch(item, "")).toBe(true);
    expect(matchesMenuSearch(item, "โอน")).toBe(true);
    expect(matchesMenuSearch(item, "ติดตาม")).toBe(true);
    expect(matchesMenuSearch(item, "po")).toBe(false);
  });

  it("prefers the longer menu href for nested product-image routes", () => {
    expect(
      isHomeMenuPathActive("/product-images/kpi", "/product-images/kpi")
    ).toBe(true);
    expect(isHomeMenuPathActive("/product-images/kpi", "/product-images")).toBe(
      false
    );
    expect(isHomeMenuPathActive("/product-images", "/product-images")).toBe(
      true
    );
    expect(isHomeMenuPathActive("/stock-audit", "/stock-audit")).toBe(true);
  });
});
