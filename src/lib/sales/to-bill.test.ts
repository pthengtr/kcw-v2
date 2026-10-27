import { describe, expect, it } from "vitest";

import {
  toBillCoverage,
  toBillCoverageLabel,
  toBillCreateHref,
} from "@/lib/sales/to-bill";

describe("to bill coverage", () => {
  it("counts issued HQ TAD bills once", () => {
    const coverage = toBillCoverage(
      ["TAD6910-001", "tad6910-001", "CNTAD6910-001", "TAD6910-002"],
      {
        "TAD6910-001": { status: "issued" },
        "TAD6910-002": { status: "draft" },
      }
    );
    expect(coverage).toEqual({ issued: 1, total: 2 });
    expect(toBillCoverageLabel(coverage)).toBe("ใบเต็ม 1/2");
    expect(toBillCoverageLabel({ issued: 0, total: 0 })).toBeNull();
  });

  it("builds the LAN create link", () => {
    expect(toBillCreateHref("http://192.168.1.21:8794/", "TAD6910-014")).toBe(
      "http://192.168.1.21:8794/to-bill/?tad=TAD6910-014"
    );
  });
});
