import { describe, expect, it } from "vitest";

import {
  applyIssuedFullInvoices,
  tadRefFromToRemark,
  vatAccountingMonth,
  compareSheets,
  compareVatRegisterRows,
  filterVatRegisterRows,
  fullInvoiceLineKey,
  isIssuedToBill,
  monthEndIso,
  summarizeVatRegister,
  summarizeVatRegisterMoney,
  vatBillDrill,
  vatLineKey,
  vatDocumentsComplete,
  vatRegisterKpiMatch,
  vatRegisterMatchesQuery,
  vatReportingMonth,
  vatRequiresReceipt,
  vatTracksPayment,
  vatUploadDocMonth,
  splitInclusiveVat,
  type VatRegisterKpiKey,
  type VatRegisterRow,
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

describe("vat upload doc month", () => {
  it("assigns uploads on the 1st–10th to the prior month", () => {
    // 8 Nov 2026 12:00 Bangkok = 05:00 UTC
    expect(vatUploadDocMonth("2026-11-08T05:00:00.000Z")).toBe("2026-10");
    expect(vatUploadDocMonth("2026-11-10T05:00:00.000Z")).toBe("2026-10");
    expect(vatUploadDocMonth("2026-11-11T05:00:00.000Z")).toBe("2026-11");
  });
});

describe("vat accounting month", () => {
  it("uses bill month for TAR/TO and TAD (ignores upload −10 days)", () => {
    expect(
      vatAccountingMonth({
        billDate: "2026-11-05",
        sheet: "TAR",
        uploadedAt: "2026-11-08T05:00:00.000Z",
      })
    ).toBe("2026-11");
    expect(
      vatAccountingMonth({
        billDate: "2026-11-05",
        sheet: "TO",
        uploadedAt: "2026-11-08T05:00:00.000Z",
      })
    ).toBe("2026-11");
    expect(
      vatAccountingMonth({
        billDate: "2026-11-05",
        sheet: "TAD",
        uploadedAt: "2026-11-08T05:00:00.000Z",
      })
    ).toBe("2026-11");
    expect(
      vatAccountingMonth({
        billDate: "2026-11-05",
        sheet: "3TAD",
        uploadedAt: "2026-11-08T05:00:00.000Z",
      })
    ).toBe("2026-11");
  });

  it("uses the upload −10 day rule for purchase uploads", () => {
    expect(
      vatAccountingMonth({
        billDate: "2026-11-05",
        sheet: "เครดิต",
        uploadedAt: "2026-11-08T05:00:00.000Z",
      })
    ).toBe("2026-10");
  });

  it("prefers an explicit doc month", () => {
    expect(
      vatAccountingMonth({
        docMonth: "2026-09-01",
        billDate: "2026-11-05",
        sheet: "TAD",
        uploadedAt: "2026-11-08T05:00:00.000Z",
      })
    ).toBe("2026-09");
  });
});

describe("split inclusive vat", () => {
  it("splits a 7% inclusive total into before and vat", () => {
    expect(splitInclusiveVat(107)).toEqual({ before: 100, vat: 7, after: 107 });
  });

  it("keeps the sign for purchase credit-note totals", () => {
    expect(splitInclusiveVat(-107)).toEqual({ before: -100, vat: -7, after: -107 });
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
        source: "to_bill",
        side: "sales",
        sheet: "TO",
        bill_no: "TO6910-002",
      })
    ).toBeNull();
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

describe("register row order", () => {
  it("sorts by bill date then bill number", () => {
    const rows = [
      { bill_date: "2026-10-03", bill_no: "B-2" },
      { bill_date: "2026-10-02", bill_no: "B-10" },
      { bill_date: "2026-10-02", bill_no: "B-2" },
    ];
    expect([...rows].sort(compareVatRegisterRows).map((row) => row.bill_no)).toEqual([
      "B-2",
      "B-10",
      "B-2",
    ]);
    expect([...rows].sort(compareVatRegisterRows).map((row) => row.bill_date)).toEqual([
      "2026-10-02",
      "2026-10-02",
      "2026-10-03",
    ]);
  });
});

describe("credit payment status", () => {
  it("tracks sales credit books and purchase credit only", () => {
    expect(vatTracksPayment("TD")).toBe(true);
    expect(vatTracksPayment("3TAD")).toBe(true);
    expect(vatTracksPayment("CNTAD")).toBe(true);
    expect(vatTracksPayment("เครดิต")).toBe(true);
    expect(vatTracksPayment("TAR")).toBe(false);
    expect(vatTracksPayment("TR")).toBe(false);
    expect(vatTracksPayment("สด")).toBe(false);
    expect(vatTracksPayment("ค่าใช้จ่าย")).toBe(false);
  });
});

describe("required documents", () => {
  it("requires a receipt only for TD sales and credit purchases", () => {
    expect(vatRequiresReceipt("TD")).toBe(true);
    expect(vatRequiresReceipt("3TD")).toBe(true);
    expect(vatRequiresReceipt("เครดิต")).toBe(true);
    expect(vatRequiresReceipt("TAD")).toBe(false);
    expect(vatRequiresReceipt("TAR")).toBe(false);
    expect(vatRequiresReceipt("TR")).toBe(false);
    expect(vatRequiresReceipt("สด")).toBe(false);
    expect(vatRequiresReceipt("ค่าใช้จ่าย")).toBe(false);
  });

  it("treats other books as complete with an invoice alone", () => {
    expect(
      vatDocumentsComplete({ sheet: "TAD", invoice_count: 1, receipt_count: 0 })
    ).toBe(true);
    expect(
      vatDocumentsComplete({ sheet: "TD", invoice_count: 1, receipt_count: 0 })
    ).toBe(false);
    expect(
      vatDocumentsComplete({ sheet: "เครดิต", invoice_count: 1, receipt_count: 1 })
    ).toBe(true);
    expect(
      vatRegisterKpiMatch(
        { sheet: "TAR", invoice_count: 1, receipt_count: 0, paid_status: "paid" },
        "missing_receipt"
      )
    ).toBe(false);
  });
});

describe("vat register summary", () => {
  const rows = [
    { sheet: "TD", invoice_count: 1, receipt_count: 1, paid_status: "paid" as const, after_vat: 100 },
    { sheet: "TAD", invoice_count: 1, receipt_count: 0, paid_status: "unpaid" as const, after_vat: 40 },
    { sheet: "TAR", invoice_count: 0, receipt_count: 2, paid_status: "paid" as const, after_vat: 25 },
    { sheet: "เครดิต", invoice_count: 0, receipt_count: 0, paid_status: "unpaid" as const, after_vat: 10 },
  ];

  it("counts missing documents, unpaid lines, and complete lines", () => {
    expect(summarizeVatRegister(rows)).toEqual({
      total: 4,
      missingReceipts: 1,
      missingReceiptAmount: 10,
      missingInvoices: 2,
      missingInvoiceAmount: 35,
      unpaid: 2,
      unpaidAmount: 50,
      complete: 2,
      completePct: 50,
    });
  });

  it("rounds the complete share to the nearest percent", () => {
    const mostlyComplete = [
      ...Array.from({ length: 6 }, () => rows[0]),
      rows[2],
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

  it("leaves cash and expense lines out of the unpaid total", () => {
    expect(
      summarizeVatRegister([
        { sheet: "สด", invoice_count: 1, receipt_count: 1, paid_status: "unpaid" as const, after_vat: 80 },
        { sheet: "TR", invoice_count: 1, receipt_count: 0, paid_status: "unpaid" as const, after_vat: 15 },
        { sheet: "CNTAD", invoice_count: 1, receipt_count: 1, paid_status: "unpaid" as const, after_vat: 20 },
      ])
    ).toMatchObject({ unpaid: 1, unpaidAmount: 20 });
    expect(
      vatRegisterKpiMatch(
        { sheet: "TAR", invoice_count: 0, receipt_count: 0, paid_status: "unpaid" },
        "unpaid"
      )
    ).toBe(false);
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

describe("issued full invoice in the tax book", () => {
  const tad: VatRegisterRow = {
    line_key: "tad",
    report_month: "2026-10-01",
    branch: "HQ",
    side: "sales",
    sheet: "TAD",
    source: "parts9",
    source_ref: null,
    bill_date: "2026-10-02",
    bill_no: "TAD6910-054",
    display_bill_no: "TAD6910-054",
    party_name: "คุณลูกค้าทั่วไป LAZADA (KC INDUSTRY)",
    party_code: null,
    tax_id: null,
    before_vat: 100,
    vat: 7,
    after_vat: 107,
    detail: "แหวน",
    remark: null,
    paid_status: "unpaid",
    paid_on: null,
    paid_from_reminder: false,
    note: null,
    invoice_count: 0,
    receipt_count: 0,
    accounting_unused: false,
    full_invoice_docno: null,
  };

  it("marks the abbreviated bill unused and counts the full invoice", () => {
    const [kept, full] = applyIssuedFullInvoices(
      [tad],
      [
        {
          tad_billno: "tad6910-054",
          docno: "to6910-002",
          customer_name: "บริษัท อินเตอร์เนชั่นแนล ฟรอนเทียร์ ยูนิเทรด จำกัด",
          tax_id: "0105556003920",
          before_vat: 584.11,
          vat: 40.89,
          after_vat: 625,
        },
      ]
    );
    expect(kept.accounting_unused).toBe(true);
    expect(kept.full_invoice_docno).toBe("TO6910-002");
    expect(kept.bill_no).toBe("TAD6910-054");
    expect(full).toMatchObject({
      sheet: "TO",
      source: "to_bill",
      bill_no: "TO6910-002",
      display_bill_no: "TO6910-002",
      party_name: "บริษัท อินเตอร์เนชั่นแนล ฟรอนเทียร์ ยูนิเทรด จำกัด",
      tax_id: "0105556003920",
      before_vat: 584.11,
      vat: 40.89,
      after_vat: 625,
      remark: "อ้างอิง TAD6910-054",
      accounting_unused: false,
      detail: "แหวน",
    });
    expect(summarizeVatRegisterMoney([kept, full])).toEqual({
      before: 584.11,
      vat: 40.89,
      after: 625,
      used: 1,
      unused: 1,
    });
    expect(vatRegisterMatchesQuery(kept, "TO6910-002")).toBe(true);
    expect(compareSheets("TAD", "TO")).toBeLessThan(0);
  });

  it("keeps the abbreviated bill when the issued document is a receipt", () => {
    const [kept] = applyIssuedFullInvoices(
      [tad],
      [
        {
          tad_billno: "TAD6910-054",
          docno: "RVO6910-001",
          customer_name: "บริษัท ทดสอบ จำกัด",
          tax_id: "1234567890123",
          before_vat: 100,
          vat: 7,
          after_vat: 107,
        },
      ]
    );
    expect(kept.accounting_unused).toBe(false);
    expect(kept.full_invoice_docno).toBeNull();
    expect(kept.bill_no).toBe("TAD6910-054");
  });

  it("uses the TAD bill date for the synthetic TO (TO follows TAD)", () => {
    const [kept, full] = applyIssuedFullInvoices(
      [tad],
      [
        {
          tad_billno: "TAD6910-054",
          docno: "TO6910-002",
          customer_name: "บริษัท ทดสอบ จำกัด",
          tax_id: "1234567890123",
          before_vat: 100,
          vat: 7,
          after_vat: 107,
          bill_date: "2026-10-15",
        },
      ]
    );
    expect(full.bill_date).toBe("2026-10-02");
    expect(full.line_key).toBe(fullInvoiceLineKey("TO6910-002", "2026-10-02"));
    expect(full.accounting_month).toBe("2026-10-01");
    expect(kept.accounting_month).toBe("2026-10-01");
    expect(kept.full_invoice_docno).toBe("TO6910-002");
    expect(tadRefFromToRemark(full.remark)).toBe("TAD6910-054");
  });

  it("ignores TAD upload month once a TO is issued", () => {
    const uploaded: VatRegisterRow = {
      ...tad,
      first_uploaded_at: "2026-11-08T05:00:00.000Z",
      accounting_month: "2026-10-01",
      bill_date: "2026-11-05",
      report_month: "2026-11-01",
    };
    const [kept, full] = applyIssuedFullInvoices(
      [uploaded],
      [
        {
          tad_billno: "TAD6910-054",
          docno: "TO6911-001",
          customer_name: "บริษัท ทดสอบ จำกัด",
          tax_id: "1234567890123",
          before_vat: 100,
          vat: 7,
          after_vat: 107,
          bill_date: "2026-11-20",
        },
      ]
    );
    expect(kept.accounting_month).toBe("2026-11-01");
    expect(full.accounting_month).toBe("2026-11-01");
    expect(full.bill_date).toBe("2026-11-05");
  });

  it("counts the issued TO record as the tax invoice without uploads", () => {
    const [, full] = applyIssuedFullInvoices(
      [tad],
      [
        {
          tad_billno: "TAD6910-054",
          docno: "TO6910-002",
          customer_name: "บริษัท ทดสอบ จำกัด",
          tax_id: "1234567890123",
          before_vat: 100,
          vat: 7,
          after_vat: 107,
        },
      ]
    );
    expect(full.invoice_count).toBe(1);
    expect(isIssuedToBill(full)).toBe(true);
    expect(vatDocumentsComplete(full)).toBe(true);
  });
});

describe("vat register search and accounting use", () => {
  const line = {
    bill_no: "TD6901001",
    display_bill_no: "TD6901001",
    party_name: "บริษัท ทดสอบ",
    party_code: "C001",
    tax_id: "0105551234567",
    accounting_unused: false,
    sheet: "TD",
    invoice_count: 1,
    receipt_count: 1,
    paid_status: "paid" as const,
    before_vat: 100,
    vat: 7,
    after_vat: 107,
  };
  const unused = {
    ...line,
    bill_no: "B2607-9",
    display_bill_no: "B2607-9",
    party_name: "ร้านไม่ใช้",
    accounting_unused: true,
    sheet: "เครดิต",
    before_vat: 50,
    vat: 3.5,
    after_vat: 53.5,
  };

  it("matches a bill number, partner, or tax id and ignores blank space", () => {
    expect(vatRegisterMatchesQuery(line, "  td6901001 ")).toBe(true);
    expect(vatRegisterMatchesQuery(line, "ทดสอบ")).toBe(true);
    expect(vatRegisterMatchesQuery(line, "010555")).toBe(true);
    expect(vatRegisterMatchesQuery(line, "ไม่มี")).toBe(false);
    expect(vatRegisterMatchesQuery(line, "   ")).toBe(true);
  });

  it("sums only lines accounting still uses", () => {
    expect(summarizeVatRegisterMoney([line, unused])).toEqual({
      before: 100,
      vat: 7,
      after: 107,
      used: 1,
      unused: 1,
    });
  });

  it("keeps an unused bill in search results until a status chip is on", () => {
    const rows = [line, unused];
    expect(filterVatRegisterRows(rows, { query: "ไม่ใช้", kpi: null })).toEqual([unused]);
    expect(filterVatRegisterRows(rows, { query: "", kpi: "complete" })).toEqual([line]);
    expect(filterVatRegisterRows(rows, { query: "B2607", kpi: "unpaid" })).toEqual([unused]);
  });
});
