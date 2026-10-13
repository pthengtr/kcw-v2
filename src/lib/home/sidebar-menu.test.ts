import { describe, expect, it } from "vitest";

import {
  canAccessHomeMenuItem,
  isHomeMenuPathActive,
  matchesMenuSearch,
} from "@/lib/home/sidebar-menu";

describe("sidebar menu helpers", () => {
  it("filters protected menu items by page keys", () => {
    const pageKeys = ["po_status", "bi_income"];
    expect(canAccessHomeMenuItem("bi", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("tigerPay", pageKeys)).toBe(false);
    expect(canAccessHomeMenuItem("expense", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("productImageKpi", pageKeys)).toBe(true);
  });

  it("matches menu search against label and description", () => {
    const item = {
      label: "ค่าใช้จ่าย",
      description: "บันทึกและตรวจสอบค่าใช้จ่าย",
    };
    expect(matchesMenuSearch(item, "")).toBe(true);
    expect(matchesMenuSearch(item, "ค่าใช้")).toBe(true);
    expect(matchesMenuSearch(item, "บันทึก")).toBe(true);
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
