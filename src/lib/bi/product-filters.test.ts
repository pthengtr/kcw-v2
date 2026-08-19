import { describe, expect, it } from "vitest";

import {
  MAX_CUSTOM_BCODES,
  normalizeCategoryParam,
  parseBcodesParam,
  serializeBcodesParam,
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
