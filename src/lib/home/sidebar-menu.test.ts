import { describe, expect, it } from "vitest";

import {
  canAccessHomeMenuItem,
  matchesMenuSearch,
} from "@/lib/home/sidebar-menu";

describe("sidebar menu helpers", () => {
  it("filters protected menu items by page keys", () => {
    const pageKeys = ["po_status", "bi_income"];
    expect(canAccessHomeMenuItem("po", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("bi", pageKeys)).toBe(true);
    expect(canAccessHomeMenuItem("tigerPay", pageKeys)).toBe(false);
    expect(canAccessHomeMenuItem("reminder", pageKeys)).toBe(true);
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
});
