import { describe, expect, it } from "vitest";

import {
  compareSheets,
  monthEndIso,
  summarizeVatRegister,
  vatBillDrill,
  vatLineKey,
  vatRegisterKpiMatch,
  vatReportingMonth,
  type VatRegisterKpiKey,
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

describe("vat register summary", () => {
  const rows = [
    { invoice_count: 1, receipt_count: 1, paid_status: "paid" as const, after_vat: 100 },
    { invoice_count: 1, receipt_count: 0, paid_status: "unpaid" as const, after_vat: 40 },
    { invoice_count: 0, receipt_count: 2, paid_status: "paid" as const, after_vat: 25 },
    { invoice_count: 0, receipt_count: 0, paid_status: "unpaid" as const, after_vat: 10 },
  ];

  it("counts missing documents, unpaid lines, and complete lines", () => {
    expect(summarizeVatRegister(rows)).toEqual({
      total: 4,
      missingReceipts: 2,
      missingReceiptAmount: 50,
      missingInvoices: 2,
      missingInvoiceAmount: 35,
      unpaid: 2,
      unpaidAmount: 50,
      complete: 1,
      completePct: 25,
    });
  });

  it("rounds the complete share to the nearest percent", () => {
    const mostlyComplete = [
      ...Array.from({ length: 6 }, () => rows[0]),
      rows[1],
    ];
    expect(summarizeVatRegister(mostlyComplete).completePct).toBe(86);
  });

  it("returns zeros for an empty list", () => {
    expect(summarizeVatRegister([])).toEqual({
      total: 0,
      missingReceipts: 0,
      missingReceiptAmount: 0,
      missingInvoices: 0,
      missingInvoiceAmount: 0,
      unpaid: 0,
      unpaidAmount: 0,
      complete: 0,
      completePct: 0,
    });
  });

  it("uses the same groups the summary counts", () => {
    const keys: VatRegisterKpiKey[] = [
      "missing_receipt",
      "missing_invoice",
      "unpaid",
      "complete",
    ];
    const summary = summarizeVatRegister(rows);
    const counts = {
      missing_receipt: summary.missingReceipts,
      missing_invoice: summary.missingInvoices,
      unpaid: summary.unpaid,
      complete: summary.complete,
    };
    for (const key of keys) {
      expect(rows.filter((row) => vatRegisterKpiMatch(row, key)).length).toBe(
        counts[key]
      );
    }
  });
});
