import { describe, expect, it } from "vitest";

import {
  toBillCoverage,
  toBillCoverageLabel,
  toBillCreateHref,
} from "@/lib/sales/to-bill";
import {
  AON,
  CARTOON,
  MAY,
  formatSheetQty,
  matchSigner,
  sheetSigners,
  shopLabel,
  signerDisplayName,
  thaiLongDate,
  thaiSlashDate,
} from "@/lib/sales/to-bill-sheet";

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
    expect(toBillCreateHref("http://192.168.1.21:8794/", "TAD6910-014", "rvo")).toBe(
      "http://192.168.1.21:8794/to-bill/?tad=TAD6910-014&kind=rvo"
    );
  });
});

describe("to bill sheet signers", () => {
  it("defaults to Aon issuer and May approver", () => {
    expect(sheetSigners("")).toEqual([AON, MAY]);
    expect(sheetSigners("อ้อน")).toEqual([AON, MAY]);
    expect(matchSigner("May")).toBe(MAY);
    expect(signerDisplayName(AON)).toBe("มัญชุนันท์ คำลา");
  });

  it("lets Cartoon sign both roles", () => {
    expect(matchSigner("การ์ตูน")).toBe(CARTOON);
    expect(sheetSigners("จิดาภา กระจาย")).toEqual([CARTOON, CARTOON]);
    expect(signerDisplayName(CARTOON)).toBe("จิดาภา กระจาย");
  });

  it("formats marketplace shop and Thai dates like kcw-api", () => {
    expect(shopLabel("คุณลูกค้าทั่วไป LAZADA (KC INDUSTRY)", "7LAZ1")).toBe(
      "LAZADA | KC INDUSTRY (7LAZ1)"
    );
    expect(thaiLongDate("2026-10-27")).toBe("27 ตุลาคม 2569");
    expect(thaiSlashDate("2026-10-27")).toBe("27/10/2569");
    expect(formatSheetQty(1)).toBe("1");
    expect(formatSheetQty(1.5)).toBe("1.5");
  });
});
