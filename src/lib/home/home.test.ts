import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  FAVORITES_COOKIE_KEY,
  normalizeFavoriteKeys,
  parseFavoriteKeys,
  serializeFavoriteKeys,
  toggleFavoriteKey,
} from "@/lib/home/favorites";
import {
  DEFAULT_FAVORITE_KEYS,
  HOME_MENU_GROUPS,
  HOME_MENU_ITEMS,
  resolveFavoriteItems,
} from "@/lib/home/menu";
import { STOCK_AUDIT_DAILY_TARGET } from "@/lib/home/workspace-todos";
import { STOCK_AUDIT_DAILY_TARGET as sharedTarget } from "@/lib/stock-audit/daily-target";

describe("home favorites", () => {
  it("falls back to default favorites when cookie is empty", () => {
    expect(parseFavoriteKeys(undefined)).toEqual(DEFAULT_FAVORITE_KEYS);
    expect(parseFavoriteKeys("")).toEqual(DEFAULT_FAVORITE_KEYS);
    expect(parseFavoriteKeys("[]")).toEqual(DEFAULT_FAVORITE_KEYS);
    expect(FAVORITES_COOKIE_KEY).toBe("home_favorite_menus");
    expect(DEFAULT_FAVORITE_KEYS).toHaveLength(2);
  });

  it("parses and normalizes favorite keys from JSON or CSV", () => {
    expect(parseFavoriteKeys(JSON.stringify(["po", "expense", "po", "nope"]))).toEqual([
      "expense",
    ]);
    expect(parseFavoriteKeys(JSON.stringify(["reminder"]))).toEqual(
      DEFAULT_FAVORITE_KEYS
    );
    expect(parseFavoriteKeys("bi,stockAudit,bi")).toEqual(["bi", "stockAudit"]);
    expect(normalizeFavoriteKeys(["faq"])).toEqual(["faq"]);
  });

  it("allows more than four favorite menus", () => {
    expect(
      normalizeFavoriteKeys([
        "expense",
        "bi",
        "bankStatement",
        "party",
        "faq",
      ])
    ).toEqual([
      "expense",
      "bi",
      "bankStatement",
      "party",
      "faq",
    ]);
  });

  it("serializes favorites and refuses emptying via toggle", () => {
    const serialized = serializeFavoriteKeys(["expense", "bi"]);
    expect(JSON.parse(serialized)).toEqual(["expense", "bi"]);
    expect(toggleFavoriteKey(["expense"], "expense")).toEqual(["expense"]);
    expect(toggleFavoriteKey(["expense"], "bi")).toEqual(["expense", "bi"]);
  });

  it("resolves favorite items from the shared menu catalog", () => {
    const items = resolveFavoriteItems(["expense", "bi"]);
    expect(items.map((item) => item.href)).toEqual(["/expense", "/bi"]);
    expect(Object.keys(HOME_MENU_ITEMS).length).toBeGreaterThanOrEqual(11);
    expect(HOME_MENU_GROUPS).toHaveLength(4);
    expect(HOME_MENU_GROUPS.map((group) => group.title)).toEqual([
      "KPI งาน",
      "การเงินและรับชำระ",
      "ข้อมูลและสินค้า",
      "รายงานและความรู้",
    ]);
    expect(HOME_MENU_GROUPS[0].items.map((item) => item.key)).toEqual([
      "stockAudit",
      "productImageKpi",
    ]);
    expect(HOME_MENU_GROUPS[1].items.map((item) => item.key)).toEqual([
      "bankStatement",
      "onlineStatements",
      "vatRegister",
      "tigerPay",
    ]);
    expect(HOME_MENU_ITEMS.vatRegister.href).toBe("/vat-register");
    expect(HOME_MENU_ITEMS.stockAudit.href).toBe("/stock-audit");
    expect(HOME_MENU_ITEMS.productImageKpi.href).toBe("/product-images/kpi");
    expect(HOME_MENU_ITEMS.productImages.href).toBe("/product-images");
  });
});

describe("home workspace todos helpers", () => {
  it("keeps the stock-audit daily target aligned with the operator page", () => {
    expect(STOCK_AUDIT_DAILY_TARGET).toBe(30);
    expect(sharedTarget).toBe(STOCK_AUDIT_DAILY_TARGET);
  });

  it("includes a Tiger hopper fill reminder", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/home/workspace-todos.ts"),
      "utf8"
    );
    expect(source).toContain("tiger-pay-hopper");
    expect(source).toContain("/tiger-pay");
    expect(source).toContain("getLatestCashSnapshot");
    expect(source).not.toContain("payment-reminder");
    expect(source).not.toContain("/reminder");
  });
});
