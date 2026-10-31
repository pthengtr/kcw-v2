import { describe, expect, it } from "vitest";

import {
  displayInvoiceCount,
  formatReceiptMoney,
  formatReceiptQty,
  isGeneratedVatBill,
  printedBillNo,
  receiptCompany,
  receiptTitle,
  receiptTotals,
  thaiReceiptDate,
} from "./generated-bill";

describe("printed VAT bills", () => {
  it("covers the four abbreviated bill sheets", () => {
    expect(isGeneratedVatBill("TAR")).toBe(true);
    expect(isGeneratedVatBill("3CNTAR")).toBe(true);
    expect(isGeneratedVatBill("TD")).toBe(false);
  });

  it("counts the on-screen bill as the invoice", () => {
    expect(displayInvoiceCount("TAR", 0)).toBe(1);
    expect(displayInvoiceCount("CNTAR", 2)).toBe(3);
    expect(displayInvoiceCount("TD", 0)).toBe(0);
  });

  it("uses the branch company and the credit-note title", () => {
    expect(receiptCompany("TAR").name).toContain("สำนักงานใหญ่");
    expect(receiptCompany("3TAR").tax).toContain("00003");
    expect(receiptTitle("TAR")).toBe("ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ");
    expect(receiptTitle("3CNTAR")).toBe("ใบลดหนี้");
  });

  it("prints a 3CNTAR number as 3CTAR", () => {
    expect(printedBillNo("3CNTAR", "3CNTAR6910-001")).toBe("3CTAR6910-001");
    expect(printedBillNo("TAR", "TAR6910-001")).toBe("TAR6910-001");
  });

  it("formats the Thai bill date and whole quantities", () => {
    expect(thaiReceiptDate("2026-10-02")).toBe("2 ต.ค. 2569");
    expect(formatReceiptQty(2)).toBe("2");
    expect(formatReceiptQty(1.5)).toBe("1.50");
  });

  it("splits inclusive amounts into base and VAT", () => {
    const totals = receiptTotals([107, 214]);
    expect(formatReceiptMoney(totals.base)).toBe("300.00");
    expect(formatReceiptMoney(totals.vat)).toBe("21.00");
    expect(formatReceiptMoney(totals.total)).toBe("321.00");
  });
});
