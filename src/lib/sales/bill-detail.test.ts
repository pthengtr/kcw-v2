import { describe, expect, it } from "vitest";

import { normalizeSalesBillDocType } from "./bill-detail";

describe("normalizeSalesBillDocType", () => {
  it("keeps an explicit doc type from the TAR day list", () => {
    expect(normalizeSalesBillDocType("TAR6905-001", "CNTAR")).toBe("CNTAR");
    expect(normalizeSalesBillDocType("3TAR6905-001", "3tar")).toBe("3TAR");
  });

  it("reads the family from the bill number", () => {
    expect(normalizeSalesBillDocType("TAR6905-001")).toBe("TAR");
    expect(normalizeSalesBillDocType("3CNTAR6905-001")).toBe("3CNTAR");
    expect(normalizeSalesBillDocType("CNTAD6908-001")).toBe("CNTAD");
    expect(normalizeSalesBillDocType("TAD6908-014")).toBe("TAD");
  });

  it("treats an unknown number as a TAD lookup", () => {
    expect(normalizeSalesBillDocType("8K69-0013225")).toBe("TAD");
  });
});
