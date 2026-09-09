import { describe, expect, it } from "vitest";

import {
  isPersonalOffsetRow,
  parseOffsetSummary,
} from "./personal-offset";

describe("personal offset helpers", () => {
  it("treats a linked negative general row as an offset", () => {
    expect(
      isPersonalOffsetRow({
        ref_receipt_uuid: "abc",
        unit_price: -10700,
        quantity: 1,
      })
    ).toBe(true);
    expect(
      isPersonalOffsetRow({
        ref_receipt_uuid: null,
        unit_price: -100,
        quantity: 1,
      })
    ).toBe(false);
    expect(
      isPersonalOffsetRow(undefined)
    ).toBe(false);
  });

  it("parses offset summary numbers", () => {
    expect(
      parseOffsetSummary({
        claimed_opex: "10700.00",
        cn_opex: 0,
        already_offset: -2000,
        remaining: 8700,
      })
    ).toEqual({
      claimed_opex: 10700,
      cn_opex: 0,
      already_offset: -2000,
      remaining: 8700,
    });
  });
});
