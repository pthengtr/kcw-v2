import { describe, expect, it } from "vitest";

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
import {
  STOCK_AUDIT_DAILY_TARGET,
  bangkokTodayIsoDate,
} from "@/lib/home/workspace-todos";

describe("home favorites", () => {
  it("falls back to default favorites when cookie is empty", () => {
    expect(parseFavoriteKeys(undefined)).toEqual(DEFAULT_FAVORITE_KEYS);
    expect(parseFavoriteKeys("")).toEqual(DEFAULT_FAVORITE_KEYS);
    expect(parseFavoriteKeys("[]")).toEqual(DEFAULT_FAVORITE_KEYS);
    expect(FAVORITES_COOKIE_KEY).toBe("home_favorite_menus");
    expect(DEFAULT_FAVORITE_KEYS).toHaveLength(4);
  });

  it("parses and normalizes favorite keys from JSON or CSV", () => {
    expect(parseFavoriteKeys(JSON.stringify(["po", "reminder", "po", "nope"]))).toEqual([
      "po",
      "reminder",
    ]);
    expect(parseFavoriteKeys("bi,stockAudit,bi")).toEqual(["bi", "stockAudit"]);
    expect(normalizeFavoriteKeys(["faq"])).toEqual(["faq"]);
  });

  it("allows more than four favorite menus", () => {
    expect(
      normalizeFavoriteKeys([
        "reminder",
        "expense",
        "po",
        "bi",
        "bankStatement",
        "party",
      ])
    ).toEqual([
      "reminder",
      "expense",
      "po",
      "bi",
      "bankStatement",
      "party",
    ]);
  });

  it("serializes favorites and refuses emptying via toggle", () => {
    const serialized = serializeFavoriteKeys(["reminder", "expense"]);
    expect(JSON.parse(serialized)).toEqual(["reminder", "expense"]);
    expect(toggleFavoriteKey(["reminder"], "reminder")).toEqual(["reminder"]);
    expect(toggleFavoriteKey(["reminder"], "po")).toEqual(["reminder", "po"]);
  });

  it("resolves favorite items from the shared menu catalog", () => {
    const items = resolveFavoriteItems(["reminder", "bi"]);
    expect(items.map((item) => item.href)).toEqual(["/reminder", "/bi/income"]);
    expect(Object.keys(HOME_MENU_ITEMS).length).toBeGreaterThanOrEqual(10);
    expect(HOME_MENU_GROUPS).toHaveLength(4);
    expect(HOME_MENU_GROUPS[0].items.map((item) => item.key)).toEqual([
      "reminder",
      "po",
      "stockAudit",
    ]);
  });
});

describe("home workspace todos helpers", () => {
  it("formats Bangkok calendar dates as YYYY-MM-DD", () => {
    expect(bangkokTodayIsoDate(new Date("2026-08-05T02:00:00.000Z"))).toBe(
      "2026-08-05"
    );
    expect(bangkokTodayIsoDate(new Date("2026-08-04T18:00:00.000Z"))).toBe(
      "2026-08-05"
    );
  });

  it("keeps the stock-audit daily target aligned with the operator page", () => {
    expect(STOCK_AUDIT_DAILY_TARGET).toBe(30);
  });
});
