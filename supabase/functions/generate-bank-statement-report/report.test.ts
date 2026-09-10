import { describe, expect, it } from "vitest";

import {
  CHEQUE_ACCOUNT_COLUMN_ORDER,
  COLUMN_ORDER,
  cleanedBankDescription,
  columnsForAccount,
  enrichStatementRows,
  extractChequeNumber,
  extractCompanyFromNotes,
  formatBillNumbers,
  formatInternalTransferDescription,
  formatNarumonCashSalesDescription,
  formatReportRemark,
  formatThaiQrPaymentDescription,
  isDocumentBillToken,
  normalizePartyDisplayName,
  resolveDescriptionColumn,
  type StatementLineRow,
} from "./report-format.ts";

function baseRow(overrides: Partial<StatementLineRow> = {}): StatementLineRow {
  return {
    account_no: "064-8-91723-6",
    bank_name: "KBANK",
    txn_date: "2026-08-01",
    value_date: null,
    description: "รับโอนเงิน",
    bank_reference: null,
    amount: 26508,
    direction: "in",
    debit: null,
    credit: 26508,
    balance_after: 1173631.99,
    raw_json: {
      รายการ: "รับโอนเงิน",
      รายละเอียด: "จาก SCB X3875 นางสาว ธัญญพัทธ์ ท++",
    },
    source_row_number: 12,
    source_file_id: null,
    match_status: "matched",
    match_reason: "ใบสำคัญรับเงิน (วันเดียวกัน)",
    match_notes:
      "จับคู่กับใบสำคัญรับเงิน RC6908-003 จำนวน 26,508.00 บาท วันที่ 01/08/2026 (วันเดียวกับใบสำคัญ) — บริษัท 168 เทรลเลอร์ทรานสปอร์ต จำกัด",
    report_remark: null,
    matched_ref_type: "rvmas",
    matched_ref_id: "RC6908-003",
    match_confidence: 0.98,
    original_filename: "stmt.xlsx",
    ...overrides,
  };
}

describe("bank statement report columns", () => {
  it("uses the simplified operator-facing column set", () => {
    expect([...COLUMN_ORDER]).toEqual([
      "#",
      "วันที่",
      "รายการ / ชื่อบริษัท",
      "ประเภท",
      "เลขที่บิล",
      "ถอนเงิน",
      "ฝากเงิน",
      "ยอดคงเหลือ",
      "หมายเหตุ",
    ]);
  });

  it("prefers matched party name over bank txn description", () => {
    const row = baseRow({
      matched_party_name: "บริษัท 168 เทรลเลอร์ทรานสปอร์ต จำกัด (สำนักงานใหญ่)",
    });
    expect(resolveDescriptionColumn(row)).toBe(
      "บริษัท 168 เทรลเลอร์ทรานสปอร์ต จำกัด",
    );
  });

  it("falls back to company extracted from match_notes", () => {
    const row = baseRow({ matched_party_name: null });
    expect(extractCompanyFromNotes(row.match_notes)).toContain(
      "168 เทรลเลอร์ทรานสปอร์ต",
    );
    expect(resolveDescriptionColumn(row)).toContain("168 เทรลเลอร์ทรานสปอร์ต");
  });

  it("falls back to cleaned bank description when unmatched", () => {
    const row = baseRow({
      match_status: "pending",
      match_reason: null,
      match_notes: null,
      matched_ref_type: null,
      matched_ref_id: null,
      matched_party_name: null,
    });
    expect(cleanedBankDescription(row)).toBe("รับโอนเงิน");
    expect(resolveDescriptionColumn(row)).toBe("รับโอนเงิน");
  });

  it("shows matched bill numbers and blanks non-document refs", () => {
    expect(formatBillNumbers(baseRow())).toBe("RC6908-003");
    expect(
      formatBillNumbers(
        baseRow({ matched_ref_id: "TR6908-020,TR6908-021" }),
      ),
    ).toBe("TR6908-020, TR6908-021");
    expect(isDocumentBillToken("2026-08-06")).toBe(false);
    expect(
      formatBillNumbers(
        baseRow({
          matched_ref_type: "tar_cntar_net",
          matched_ref_id: "2026-08-06",
        }),
      ),
    ).toBe("");
    expect(
      formatBillNumbers(
        baseRow({
          matched_ref_type: "expense_pv",
          matched_ref_id: "ca9ff494-0d91-4ebe-bcf0-f7bf555d9c33",
          matched_bill_nos: "1015583",
        }),
      ),
    ).toBe("1015583");
  });

  it("uses short document-type notes and unmatched fallback", () => {
    expect(formatReportRemark(baseRow())).toBe("ใบสำคัญรับเงิน");
    expect(
      formatReportRemark(
        baseRow({ matched_ref_type: "pvmas", match_reason: "ใบสำคัญจ่าย (วันเดียวกัน)" }),
      ),
    ).toBe("ใบสำคัญจ่าย");
    expect(
      formatReportRemark(
        baseRow({
          matched_ref_type: "tar_cntar_net",
          match_reason: "ยอดขายสุทธิ TAR (เข้าวันถัดไป)",
        }),
      ),
    ).toBe("รับชำระลูกหนี้");
    expect(
      formatReportRemark(
        baseRow({
          match_status: "pending",
          matched_ref_type: null,
          matched_ref_id: null,
          match_reason: null,
        }),
      ),
    ).toBe("ยังไม่พบรายการจับคู่");
  });

  it("labels matched TAR / 3TAR daily net sales with the sales date", () => {
    expect(
      resolveDescriptionColumn(
        baseRow({
          description: "รับโอนเงิน",
          match_status: "matched",
          match_reason: "ยอดขายสุทธิ TAR (เข้าวันถัดไป)",
          match_notes:
            "ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 31/07/2026 จำนวน 88,170.70 บาท",
          matched_ref_type: "tar_cntar_net",
          matched_ref_id: "2026-07-31",
          matched_party_name: null,
          credit: 88170.7,
        }),
      ),
    ).toBe("ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 31/07/2026");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "064-8-92039-3",
          description: "รับโอนเงิน",
          match_status: "matched",
          match_reason: "ยอดขายสุทธิ 3TAR (เข้าวันถัดไป)",
          match_notes:
            "ยอดขายสุทธิรายวัน (3TAR หัก 3CNTAR) ของวันที่ 31/07/2026 จำนวน 40,357.40 บาท",
          matched_ref_type: "tar_cntar_net",
          matched_ref_id: "2026-07-31",
          matched_party_name: null,
          credit: 40357.4,
        }),
      ),
    ).toBe("ยอดขายสุทธิรายวัน (3TAR หัก 3CNTAR) ของวันที่ 31/07/2026");
  });

  it("labels KTB marketplace settlements from detail keywords", () => {
    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "248-0-42113-9",
          bank_name: "KTB",
          description: "TR from 9825080752 Shopeepay (Thailand)C",
          match_status: "unmatched",
          match_reason: null,
          match_notes: null,
          matched_ref_type: null,
          matched_ref_id: null,
          matched_party_name: null,
          raw_json: {
            DESCRIPTION: "TR from 9825080752 Shopeepay (Thailand)C",
          },
        }),
      ),
    ).toBe("ลูกค้า Shopee");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "248-0-42113-9",
          bank_name: "KTB",
          description: "BPS/017/01/Lazada Ltd./108682",
          match_status: "manual",
          matched_party_name: null,
          raw_json: { DESCRIPTION: "BPS/017/01/Lazada Ltd./108682" },
        }),
      ),
    ).toBe("ลูกค้า Lazada");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "248-0-42113-9",
          bank_name: "KTB",
          description: "TT from TikTok Shop payout",
          match_status: "unmatched",
          matched_party_name: null,
          raw_json: { DESCRIPTION: "TT from TikTok Shop payout" },
        }),
      ),
    ).toBe("ลูกค้า TikTok");

    // Other accounts keep bank text even if keyword appears.
    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "064-8-91723-6",
          bank_name: "KBANK",
          description: "Shopee transfer",
          match_status: "unmatched",
          match_reason: null,
          match_notes: null,
          matched_ref_type: null,
          matched_ref_id: null,
          matched_party_name: null,
          raw_json: { รายการ: "รับโอนเงิน", รายละเอียด: "Shopee" },
        }),
      ),
    ).toBe("รับโอนเงิน");
  });

  it("enriches the example RC6908-003 row into the simplified layout", () => {
    const [enriched] = enrichStatementRows([
      baseRow({
        matched_party_name: "บริษัท 168 เทรลเลอร์ทรานสปอร์ต จำกัด",
      }),
    ]);
    expect(enriched["รายการ / ชื่อบริษัท"]).toBe(
      "บริษัท 168 เทรลเลอร์ทรานสปอร์ต จำกัด",
    );
    expect(enriched["ประเภท"]).toBe("ใบสำคัญรับเงิน");
    expect(enriched["เลขที่บิล"]).toBe("RC6908-003");
    expect(enriched["ถอนเงิน"]).toBeNull();
    expect(enriched["ฝากเงิน"]).toBe(26508);
    expect(enriched["ยอดคงเหลือ"]).toBe(1173631.99);
    expect(enriched["หมายเหตุ"]).toBe("");
    expect(enriched._match_status).toBe("matched");
    expect(enriched.วันที่).toBeInstanceOf(Date);
  });

  it("fills Excel หมายเหตุ from report_remark", () => {
    const [enriched] = enrichStatementRows([
      baseRow({ report_remark: "  รับชำระตามใบแจ้งหนี้  " }),
    ]);
    expect(enriched["หมายเหตุ"]).toBe("รับชำระตามใบแจ้งหนี้");
    expect(enriched["ประเภท"]).toBe("ใบสำคัญรับเงิน");
  });

  it("normalizes HQ suffix on party names", () => {
    expect(
      normalizePartyDisplayName(
        "บริษัท ไทยไม้ซุง จำกัด  (สำนักงานใหญ่)",
      ),
    ).toBe("บริษัท ไทยไม้ซุง จำกัด");
  });

  it("adds เลขที่เช็ค only on the KTB 248-6-00618-4 sheet", () => {
    expect([...COLUMN_ORDER]).not.toContain("เลขที่เช็ค");
    expect([...CHEQUE_ACCOUNT_COLUMN_ORDER]).toEqual([
      "#",
      "วันที่",
      "รายการ / ชื่อบริษัท",
      "ประเภท",
      "เลขที่บิล",
      "เลขที่เช็ค",
      "ถอนเงิน",
      "ฝากเงิน",
      "ยอดคงเหลือ",
      "หมายเหตุ",
    ]);
    expect(columnsForAccount("KTB", "248-6-00618-4")).toBe(
      CHEQUE_ACCOUNT_COLUMN_ORDER,
    );
    expect(columnsForAccount("KTB", "248-0-42113-9")).toBe(COLUMN_ORDER);
    expect(columnsForAccount("KBANK", "064-8-91723-6")).toBe(COLUMN_ORDER);
  });

  it("extracts only the cheque number from KTB 6184 CHEQUE NO. / bank_reference", () => {
    const chequeRow = baseRow({
      account_no: "248-6-00618-4",
      bank_name: "KTB",
      direction: "out",
      debit: 91153,
      credit: null,
      description: "SBK:11 SBR:642 ICAS INCL R1",
      bank_reference: "10127932",
      matched_ref_type: "pimas",
      matched_ref_id: "D-O-260700015",
      matched_party_name: "บจก.ศรีสยามกลการ",
      raw_json: {
        DESCRIPTION: "SBK:11 SBR:642 ICAS INCL R1",
        "CHEQUE NO.": "10127932",
        "TRANSACTION CODE": "CBCA",
      },
    });
    expect(extractChequeNumber(chequeRow)).toBe("10127932");
    expect(enrichStatementRows([chequeRow])[0]["เลขที่เช็ค"]).toBe("10127932");

    const transferIn = baseRow({
      account_no: "248-6-00618-4",
      bank_name: "KTB",
      description: "TR fr 2480421139 KIATCHAI AUTO PART 2007",
      bank_reference: null,
      matched_ref_type: "internal_transfer",
      matched_ref_id: "248-0-42113-9",
      matched_party_name: null,
      raw_json: {
        DESCRIPTION: "TR fr 2480421139 KIATCHAI AUTO PART 2007",
        "CHEQUE NO.": "",
      },
    });
    expect(extractChequeNumber(transferIn)).toBe("");

    expect(
      extractChequeNumber(
        baseRow({
          account_no: "064-8-91723-6",
          bank_name: "KBANK",
          bank_reference: "10127932",
          raw_json: { "CHEQUE NO.": "10127932" },
        }),
      ),
    ).toBe("");
  });

  it("keeps Thai QR Payment as the item name without company or payer suffix", () => {
    const row = baseRow({
      description: "รับเงินจากการขายด้วย Thai QR Payment",
      match_status: "matched",
      match_reason: "ยอดเหลือ TR ผ่าน Thai QR",
      match_notes:
        "ยอดเหลือจากบิลโอน TR ที่ยังไม่ถูกโอนแยก (TR6909-004) รวม 8,358.34 บาท เข้าผ่าน Thai QR",
      matched_ref_type: "tr_remainder",
      matched_ref_id: "TR6909-004",
      matched_party_name: "บริษัท ลูกค้า จำกัด",
      raw_json: {
        รายการ: "รับเงินจากการขายด้วย Thai QR Payment",
        รายละเอียด: "จาก KB000002091234 เกียรติชัยอะไหล่ยนต์ 2007",
        ช่องทาง: "EDC/K SHOP/MYQR",
      },
    });
    expect(formatThaiQrPaymentDescription(row)).toBe(
      "รับเงินจากการขายด้วย Thai QR Payment",
    );
    expect(resolveDescriptionColumn(row)).toBe(
      "รับเงินจากการขายด้วย Thai QR Payment",
    );
  });

  it("labels Narumon cash deposits matched to TR / 3TR with bill date", () => {
    expect(
      formatNarumonCashSalesDescription(
        baseRow({
          description: "รับโอนเงิน",
          match_reason: "เงินสดหน้าร้าน (บิลโอน TR)",
          match_notes:
            "เงินสดหน้าร้านจาก X2446 วันที่ 31/08/2026 จำนวน 1,285.00 บาท ตรงกับ TR6908-062 วันที่บิล 30/08/2026 แบบ T+1",
          matched_ref_type: "tr_bill",
          matched_ref_id: "TR6908-062",
          matched_party_name: "ลูกค้าเงินสด",
          matched_bill_date: "2026-08-30",
          raw_json: {
            รายการ: "รับโอนเงิน",
            รายละเอียด: "จาก KTB X2446 NARUMON WITHAYAPAL++",
          },
        }),
      ),
    ).toBe("ขายเงินสด TR 30/08/2026");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "064-8-92039-3",
          description: "รับโอนเงิน",
          match_reason: "บิลโอน 3TR (ใบเดียว)",
          match_notes:
            "รับโอน 650.00 บาท วันที่ 27/08/2026 ตรงกับ 3TR6908-014 วันที่ 26/08/2026 (T+1)",
          matched_ref_type: "tr_bill",
          matched_ref_id: "3TR6908-014",
          matched_party_name: "ลูกค้าเงินสด",
          raw_json: {
            รายการ: "รับโอนเงิน",
            รายละเอียด: "จาก KTB X2446 นฤมล วิทยผโลทัย / Narumon Withayapalothai",
          },
        }),
      ),
    ).toBe("ขายเงินสด 3TR 26/08/2026");

    // TAR net from Narumon keeps the daily-net sales label, not ขายเงินสด.
    expect(
      resolveDescriptionColumn(
        baseRow({
          description: "รับโอนเงิน",
          match_reason: "ยอดขายสุทธิ TAR (เข้าวันถัดไป)",
          match_notes:
            "ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 04/09/2026 จำนวน 138,208.20 บาท",
          matched_ref_type: "tar_cntar_net",
          matched_ref_id: "2026-09-04",
          matched_party_name: null,
          raw_json: {
            รายการ: "รับโอนเงิน",
            รายละเอียด: "จาก KTB X2446 NARUMON WITHAYAPAL++",
          },
        }),
      ),
    ).toBe("ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 04/09/2026");
  });

  it("labels internal company-account sweeps as โอนไป / รับโอน with bank code", () => {
    expect(
      formatInternalTransferDescription(
        baseRow({
          account_no: "248-0-42113-9",
          bank_name: "KTB",
          direction: "out",
          description: "TR to 2486006184 KIATCHAI AUTO PART 2007",
          matched_ref_type: "internal_transfer",
          matched_ref_id: "248-6-00618-4",
          matched_party_name: "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด",
          raw_json: {
            DESCRIPTION: "TR to 2486006184 KIATCHAI AUTO PART 2007",
          },
        }),
      ),
    ).toBe("โอนไป KTB 2486006184");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "248-6-00618-4",
          bank_name: "KTB",
          direction: "in",
          description: "TR fr 2480421139 KIATCHAI AUTO PART 2007",
          match_reason: "โอนภายใน",
          matched_ref_type: "internal_transfer",
          matched_ref_id: "248-0-42113-9",
          matched_party_name: null,
          raw_json: {
            DESCRIPTION: "TR fr 2480421139 KIATCHAI AUTO PART 2007",
          },
        }),
      ),
    ).toBe("รับโอน KTB 2480421139");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "064-8-91723-6",
          bank_name: "KBANK",
          direction: "out",
          description: "โอนเงิน",
          match_reason: "โอนภายใน",
          matched_ref_type: "internal_transfer",
          matched_ref_id: "141-1-72355-7",
          matched_party_name: null,
          raw_json: {
            รายการ: "โอนเงิน",
            รายละเอียด: "โอนไป X3557 บจก. เกียรติชัยอะไ++",
          },
        }),
      ),
    ).toBe("โอนไป KBANK 1411723557");

    expect(
      resolveDescriptionColumn(
        baseRow({
          account_no: "248-6-00618-4",
          bank_name: "KTB",
          direction: "in",
          description: "004-0648920393",
          match_reason: "โอนภายใน",
          matched_ref_type: "internal_transfer",
          matched_ref_id: "064-8-92039-3",
          matched_party_name: null,
          raw_json: { DESCRIPTION: "004-0648920393" },
        }),
      ),
    ).toBe("รับโอน KBANK 0648920393");
  });
});
