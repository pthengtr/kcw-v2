import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { VatRegisterRow } from "./register";
import {
  compactBillRange,
  excelBillNo,
  HQ_COMPANY,
  SYP_COMPANY,
  vatBuyerName,
  vatRegisterWorkbookFiles,
  vatThaiDate,
} from "./register-excel";
import { buildVatRegisterDownload } from "./register-workbook";

function line(
  partial: Partial<VatRegisterRow> & Pick<VatRegisterRow, "sheet" | "bill_no" | "side">
): VatRegisterRow {
  return {
    line_key: partial.bill_no,
    report_month: "2026-10-01",
    branch: "HQ",
    source: "parts9",
    source_ref: null,
    bill_date: "2026-10-02",
    display_bill_no: partial.bill_no.slice(-13),
    party_name: "คุณลูกค้าทั่วไป",
    party_code: null,
    tax_id: "0000000000000",
    before_vat: 100,
    vat: 7,
    after_vat: 107,
    detail: "อะไหล่",
    remark: "",
    paid_status: "unpaid",
    paid_on: null,
    paid_from_reminder: false,
    note: null,
    invoice_count: 0,
    receipt_count: 0,
    accounting_unused: false,
    full_invoice_docno: null,
    ...partial,
  };
}

describe("vat excel helpers", () => {
  it("formats a Buddhist Era date and shortens bill numbers", () => {
    expect(vatThaiDate("2026-10-02")).toBe("02/10/2569");
    expect(excelBillNo("TD6901000123456", "TD")).toBe("6901000123456");
    expect(excelBillNo("3CNTAR6910-001", "3CNTAR")).toBe("3CTAR6910-001");
    expect(excelBillNo("3CNTAR6910-001", "CNTAR")).toBe("CNTAR6910-001");
  });

  it("compacts a same-day TAR range and restores CNTAR dashes", () => {
    expect(compactBillRange("TAR6910-001", "TAR6910-003")).toBe("R6910-001-003");
    expect(compactBillRange("TAR6910-001", "TAR6910-001")).toBe("R6910-001");
    expect(compactBillRange("CNTAR6910001", "CNTAR6910003")).toBe(
      "CNTAR6910-001 - CNTAR6910-003"
    );
    expect(compactBillRange("TD6910-001", "TD6910-002")).toBe("TD6910-001 - TD6910-002");
  });

  it("rewrites marketplace buyers on TAD and CNTAD only", () => {
    expect(vatBuyerName("TAD", "คุณลูกค้าทั่วไป LAZADA (KC)")).toBe(
      "คุณลูกค้าทั่วไป Lazada"
    );
    expect(vatBuyerName("TD", "ร้าน shopee")).toBe("ร้าน shopee");
  });
});

describe("vat workbook files", () => {
  const rows = [
    line({ sheet: "TAR", side: "sales", bill_no: "TAR6910-001", bill_date: "2026-10-02" }),
    line({
      sheet: "TAR",
      side: "sales",
      bill_no: "TAR6910-002",
      bill_date: "2026-10-02",
      before_vat: 200,
      vat: 14,
      after_vat: 214,
    }),
    line({
      sheet: "TAR",
      side: "sales",
      bill_no: "TAR6910-009",
      accounting_unused: true,
    }),
    line({
      sheet: "TAD",
      side: "sales",
      bill_no: "TAD6910-054",
      party_name: "ลูกค้า lazada",
      tax_id: "1234567890123",
      bill_date: "2026-10-03",
    }),
    line({
      sheet: "TO",
      side: "sales",
      bill_no: "TO6910-002",
      party_name: "บริษัท ทดสอบ",
      tax_id: "0105555555555",
      bill_date: "2026-10-03",
    }),
    line({
      sheet: "เครดิต",
      side: "purchase",
      bill_no: "B2610-001",
      party_name: "ร้านอะไหล่",
      tax_id: "0999999999999",
    }),
    line({
      sheet: "3TD",
      side: "sales",
      branch: "SYP",
      bill_no: "3TD6910001",
      party_name: "สาขา",
    }),
  ];

  it("builds the HQ sales book in Drive sheet order and skips unused lines", () => {
    const [file] = vatRegisterWorkbookFiles(rows, {
      month: "2026-10",
      branch: "HQ",
      side: "sales",
    });
    expect(file.filename).toBe("vat_sales_report_2026_10_hq.xlsx");
    expect(file.company).toEqual(HQ_COMPANY);
    expect(file.sheets.map((sheet) => sheet.name)).toEqual([
      "TAR",
      "TAD",
      "TO",
      "TAR (รายวัน)",
      "รวม",
      "สรุป TAR CNTAR (รายวัน)",
    ]);

    const tar = file.sheets[0];
    expect(tar.columns[3]).toBe("ชื่อผู้ซื้อสินค้า");
    expect(tar.rows.map((row) => row[2])).toEqual(["TAR6910-001", "TAR6910-002", "รวม"]);
    expect(tar.rows[2][5]).toBe(300);
    expect(tar.rows[2][6]).toBe(21);
    expect(tar.rows[2][7]).toBe(321);

    const daily = file.sheets.find((sheet) => sheet.name === "TAR (รายวัน)");
    expect(daily?.rows[0][2]).toBe("R6910-001-002");
    expect(daily?.rows[0][5]).toBe(300);

    const tad = file.sheets.find((sheet) => sheet.name === "TAD");
    expect(tad?.rows[0][3]).toBe("คุณลูกค้าทั่วไป Lazada");

    const combined = file.sheets.find((sheet) => sheet.name === "รวม");
    expect(combined?.rows.map((row) => row[2])).toEqual([
      "R6910-001-002",
      "TAD6910-054",
      "TO6910-002",
      "รวม",
    ]);

    const summary = file.sheets.find((sheet) => sheet.name === "สรุป TAR CNTAR (รายวัน)");
    expect(summary?.rows[0][4]).toBe("R6910-001-002");
    expect(summary?.rows[0][5]).toBe(321);
    expect(summary?.rows[0][7]).toBe(0);
    expect(summary?.rows[0][2]).toBe("คุณลูกค้าทั่วไป");
  });

  it("keeps empty purchase sheets and writes a SYP sales book", () => {
    const files = vatRegisterWorkbookFiles(rows, {
      month: "2026-10",
      branch: "ALL",
      side: "ALL",
    });
    expect(files.map((file) => file.filename)).toEqual([
      "vat_sales_report_2026_10_hq.xlsx",
      "vat_purchases_report_2026_10_hq.xlsx",
      "vat_sales_report_2026_10_syp.xlsx",
      "vat_purchases_report_2026_10_syp.xlsx",
    ]);
    const purchase = files[1];
    expect(purchase.sheets.map((sheet) => sheet.name)).toEqual([
      "เครดิต",
      "สด",
      "ลดหนี้ซื้อ",
      "เพิ่มหนี้ซื้อ",
      "Unknown",
      "ลดหนี้ค่าใช้จ่าย",
      "ค่าใช้จ่าย",
      "รวม",
    ]);
    expect(purchase.sheets.find((sheet) => sheet.name === "สด")?.rows).toEqual([]);
    const credit = purchase.sheets.find((sheet) => sheet.name === "เครดิต");
    expect(credit?.rows[0][2]).toBe("B2610-001");
    expect(credit?.rows[0][3]).toBe("ร้านอะไหล่");
    expect(credit?.columns[3]).toBe("ชื่อผู้ขายสินค้า");

    const syp = files[2];
    expect(syp.company).toEqual(SYP_COMPANY);
    expect(syp.sheets.map((sheet) => sheet.name)).toEqual(["3TD", "รวม"]);
  });
});

describe("vat workbook bytes", () => {
  it("writes the company header and a zip when more than one book is produced", async () => {
    const rows = [
      line({ sheet: "TD", side: "sales", bill_no: "TD6910001" }),
      line({ sheet: "เครดิต", side: "purchase", bill_no: "B2610-001", party_name: "ร้าน" }),
    ];
    const one = await buildVatRegisterDownload(rows, {
      month: "2026-10",
      branch: "HQ",
      side: "sales",
    });
    expect(one?.filename).toBe("vat_sales_report_2026_10_hq.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(one!.body as unknown as ExcelJS.Buffer);
    const td = wb.getWorksheet("TD");
    expect(td?.getCell("A1").value).toBe("รายงานภาษีขาย (TD)");
    expect(td?.getCell("D3").value).toBe(HQ_COMPANY.name);
    expect(td?.getCell("D5").value).toBe(HQ_COMPANY.taxId);
    expect(td?.getCell("A7").value).toBe("ลำดับ");
    expect(td?.getCell("C8").value).toBe("TD6910001");
    expect(td?.getCell("H8").value).toBe(107);
    expect(td?.getCell("H8").numFmt).toBe("#,##0.00");
    expect(td?.getCell("C9").value).toBe("รวม");

    const many = await buildVatRegisterDownload(rows, {
      month: "2026-10",
      branch: "HQ",
      side: "ALL",
    });
    expect(many?.filename).toBe("vat_reports_2026_10.zip");
    expect(many?.body.includes(Buffer.from("vat_sales_report_2026_10_hq.xlsx"))).toBe(true);
    expect(many?.body.includes(Buffer.from("vat_purchases_report_2026_10_hq.xlsx"))).toBe(
      true
    );
  });
});
