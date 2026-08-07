import { describe, expect, it } from "vitest";

import {
  computeUsedRangeFromKeys,
  decodeCellA1,
  encodeCellA1,
  expandSheetRef,
} from "./sheet-range.ts";

describe("sheet-range", () => {
  it("round-trips A1 addresses", () => {
    expect(encodeCellA1(0, 0)).toBe("A1");
    expect(encodeCellA1(11, 8)).toBe("I12");
    expect(decodeCellA1("I54")).toEqual({ r: 53, c: 8 });
  });

  it("computes used range from sparse cell keys (KTB truncated !ref case)", () => {
    const keys = ["A6", "I6", "A11", "I11", "A12", "I12", "A54", "I54", "!ref", "!margins"];
    expect(computeUsedRangeFromKeys(keys)).toBe("A6:I54");
  });

  it("expands truncated !ref in place", () => {
    const sheet: Record<string, unknown> = {
      "!ref": "A1:I12",
      A6: { t: "s", v: "Account" },
      I12: { t: "s", v: "hdr" },
      A13: { t: "s", v: "01-07-2026" },
      I54: { t: "n", v: 1 },
    };
    // Union of stated A1:I12 and cells through I54.
    expect(expandSheetRef(sheet)).toBe("A1:I54");
    expect(sheet["!ref"]).toBe("A1:I54");
  });
});
