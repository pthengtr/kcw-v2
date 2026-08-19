import { describe, expect, it } from "vitest";

import {
  MAX_CUSTOM_BCODES,
  normalizeCategoryParam,
  parseBcodesParam,
  parseProductSalesSelection,
  serializeBcodesParam,
  writeProductSalesSelection,
} from "./product-filters";

describe("normalizeCategoryParam", () => {
  it("pads a one-digit code and rejects empty", () => {
    expect(normalizeCategoryParam("12")).toBe("12");
    expect(normalizeCategoryParam("2")).toBe("02");
    expect(normalizeCategoryParam(" 22 ")).toBe("22");
    expect(normalizeCategoryParam("")).toBeNull();
    expect(normalizeCategoryParam("ab")).toBeNull();
  });
});

describe("parseBcodesParam", () => {
  it("splits, trims, dedupes, and caps the set", () => {
    expect(parseBcodesParam("22010574, 21050289")).toEqual([
      "22010574",
      "21050289",
    ]);
    expect(parseBcodesParam("A,A,B")).toEqual(["A", "B"]);
    expect(parseBcodesParam("")).toEqual([]);
    const many = Array.from({ length: MAX_CUSTOM_BCODES + 3 }, (_, i) =>
      String(i + 1)
    ).join(",");
    expect(parseBcodesParam(many)).toHaveLength(MAX_CUSTOM_BCODES);
  });
});

describe("serializeBcodesParam", () => {
  it("round-trips a unique list", () => {
    expect(serializeBcodesParam(["22010574", "22010574", "21"])).toBe(
      "22010574,21"
    );
  });
});

describe("parseProductSalesSelection", () => {
  it("keeps ranking ?bcode= as a one-SKU set", () => {
    const params = new URLSearchParams("bcode=22010574");
    expect(parseProductSalesSelection(params)).toEqual(["22010574"]);
  });

  it("prefers ?bcodes= and prepends a stray bcode", () => {
    expect(
      parseProductSalesSelection(
        new URLSearchParams("bcodes=22010574,21050289")
      )
    ).toEqual(["22010574", "21050289"]);
    expect(
      parseProductSalesSelection(
        new URLSearchParams("bcode=99&bcodes=22010574,21050289")
      )
    ).toEqual(["99", "22010574", "21050289"]);
  });
});

describe("writeProductSalesSelection", () => {
  it("writes bcode for one SKU and bcodes for many", () => {
    const one = new URL("https://example.test/bi/product-sales?bcodes=x");
    writeProductSalesSelection(one, ["22010574"]);
    expect(one.searchParams.get("bcode")).toBe("22010574");
    expect(one.searchParams.get("bcodes")).toBeNull();

    const many = new URL("https://example.test/bi/product-sales?bcode=x");
    writeProductSalesSelection(many, ["22010574", "21050289"]);
    expect(many.searchParams.get("bcode")).toBeNull();
    expect(many.searchParams.get("bcodes")).toBe("22010574,21050289");
  });
});
