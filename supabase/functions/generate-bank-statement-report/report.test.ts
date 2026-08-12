import { describe, expect, it } from "vitest";

import {
  COLUMN_ORDER,
  cleanedBankDescription,
  enrichStatementRows,
  extractCompanyFromNotes,
  formatBillNumbers,
  formatReportRemark,
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

  it("normalizes HQ suffix on party names", () => {
    expect(
      normalizePartyDisplayName(
        "บริษัท ไทยไม้ซุง จำกัด  (สำนักงานใหญ่)",
      ),
    ).toBe("บริษัท ไทยไม้ซุง จำกัด");
  });
});
