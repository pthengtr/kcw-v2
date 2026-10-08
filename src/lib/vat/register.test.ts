import { describe, expect, it } from "vitest";

import {
  compareSheets,
  monthEndIso,
  vatBillDrill,
  vatLineKey,
  vatReportingMonth,
} from "./register";

describe("vat line key", () => {
  it("matches the postgres md5 of the natural key", () => {
    expect(
      vatLineKey({
        branch: "HQ",
        side: "purchase",
        sheet: "เครดิต",
        billNo: "VT6901209",
        billDate: "2026-02-01",
      })
    ).toBe("59a01df93a42627402c8d96de0efa547");
  });
});

describe("vat reporting month", () => {
  it("uses Bangkok today minus 10 days", () => {
    expect(vatReportingMonth(new Date("2026-10-08T04:00:00.000Z"))).toBe(
      "2026-09"
    );
    expect(vatReportingMonth(new Date("2026-10-20T04:00:00.000Z"))).toBe(
      "2026-10"
    );
  });
});

describe("month bounds", () => {
  it("ends on the last day of the month", () => {
    expect(monthEndIso("2026-09-01")).toBe("2026-09-30");
    expect(monthEndIso("2024-02-01")).toBe("2024-02-29");
  });
});

describe("bill drill-down", () => {
  it("opens sales, TAR, and purchase bills, and skips expenses", () => {
    expect(
      vatBillDrill({
        source: "parts9",
        side: "sales",
        sheet: "TD",
        bill_no: "TD6901001",
      })
    ).toEqual({ billno: "TD6901001", docType: "TD", source: "sales" });
    expect(
      vatBillDrill({
        source: "tar",
        side: "sales",
        sheet: "3TAR",
        bill_no: "3TAR6901001",
      })
    ).toEqual({ billno: "3TAR6901001", docType: "3TAR", source: "sales" });
    expect(
      vatBillDrill({
        source: "parts9",
        side: "purchase",
        sheet: "เครดิต",
        bill_no: "B2607-1080",
      })
    ).toEqual({ billno: "B2607-1080", source: "purchase" });
    expect(
      vatBillDrill({
        source: "expense",
        side: "purchase",
        sheet: "ค่าใช้จ่าย",
        bill_no: "EXP-1",
      })
    ).toBeNull();
  });
});

describe("sheet order", () => {
  it("puts TAR before TD and credit purchases before cash", () => {
    expect(compareSheets("TD", "TAR")).toBeGreaterThan(0);
    expect(compareSheets("เครดิต", "สด")).toBeLessThan(0);
  });
});
