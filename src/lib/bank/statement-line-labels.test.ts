import { describe, expect, it } from "vitest";

import {
  decorateStatementLineLabels,
  statementItemLabel,
} from "@/lib/bank/statement-line-labels";

describe("statement line display labels", () => {
  it("uses the same Thai QR item name as the Excel report", () => {
    expect(
      statementItemLabel({
        account_no: "064-8-91723-6",
        bank_name: "KBANK",
        direction: "in",
        description: "รับเงินจากการขายด้วย Thai QR Payment",
        match_status: "matched",
        matched_ref_type: "tr_remainder",
        matched_ref_id: "TR6909-004",
        raw_json: {
          รายการ: "รับเงินจากการขายด้วย Thai QR Payment",
          รายละเอียด: "จาก KB000002091234 เกียรติชัยอะไหล่ยนต์ 2007",
        },
      }),
    ).toBe("รับเงินจากการขายด้วย Thai QR Payment");
  });

  it("labels internal transfers like the Excel report", () => {
    expect(
      statementItemLabel({
        account_no: "248-0-42113-9",
        bank_name: "KTB",
        direction: "out",
        description: "TR to 2486006184 KIATCHAI AUTO PART 2007",
        match_status: "matched",
        matched_ref_type: "internal_transfer",
        matched_ref_id: "248-6-00618-4",
        raw_json: {
          DESCRIPTION: "TR to 2486006184 KIATCHAI AUTO PART 2007",
        },
      }),
    ).toBe("โอนไป KTB 2486006184");
  });

  it("attaches item_label onto statement rows", async () => {
    const [row] = await decorateStatementLineLabels([
      {
        id: "1",
        description: "รับโอนเงิน",
        account_no: "064-8-91723-6",
        bank_name: "KBANK",
        direction: "in",
        match_status: "matched",
        matched_ref_type: "tar_cntar_net",
        matched_ref_id: "2026-09-04",
        match_reason: "ยอดขายสุทธิ TAR (เข้าวันถัดไป)",
        match_notes:
          "ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 04/09/2026 จำนวน 138,208.20 บาท",
        raw_json: { รายการ: "รับโอนเงิน" },
      },
    ]);
    expect(row.item_label).toBe(
      "ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 04/09/2026",
    );
    expect(row.id).toBe("1");
  });

  it("maps IORSDT TikTok settlement accounts to ลูกค้า TikTok", () => {
    expect(
      statementItemLabel({
        account_no: "248-0-42113-9",
        bank_name: "KTB",
        direction: "in",
        description: "004-1521670041",
        match_status: "manual",
        match_reason: "TikTok",
        match_notes: "ยอด 23,838.16 บาท วันที่ 09/09/2026 มาจาก TikTok",
        matched_ref_type: "rvi",
        raw_json: {
          DESCRIPTION: "004-1521670041",
          "TRANSACTION CODE": "IORSDT",
        },
      }),
    ).toBe("ลูกค้า TikTok");
  });

  it("keeps IORSDT customer receipts as the matched company, not TikTok", () => {
    expect(
      statementItemLabel({
        account_no: "248-0-42113-9",
        bank_name: "KTB",
        direction: "in",
        description: "011-4861074666",
        match_status: "manual",
        match_reason: "ใบสำคัญรับ",
        match_notes:
          "เงินเข้า 91,262.21 วันที่ 07/09/2026 ตรง RC6909-008 บริษัท อุตสาหกรรมไม้ กระแสบน จำกัด (สำนักงานใหญ่)  ลงวันที่ 08/09/2026",
        matched_ref_type: "rvmas",
        matched_ref_id: "RC6909-008",
        raw_json: {
          DESCRIPTION: "011-4861074666",
          "TRANSACTION CODE": "IORSDT",
        },
      }),
    ).toBe("บริษัท อุตสาหกรรมไม้ กระแสบน จำกัด");
  });

  it("replaces generic โอนเงิน with the vendor name from PIMAS match notes", () => {
    expect(
      statementItemLabel({
        account_no: "141-1-72355-7",
        bank_name: "KBANK",
        direction: "out",
        description: "โอนเงิน",
        match_status: "matched",
        match_reason: "บิลซื้อ PIMAS (วันเดียวกัน)",
        match_notes:
          "จับคู่กับบิลซื้อ SCT0448/09-69 หจก.ซีลเซ็นเตอร์ จำนวน 290.33 บาท วันที่ 02/09/2026 ตรงยอดและชื่อคู่ค้า",
        matched_ref_type: "pimas",
        matched_ref_id: "SCT0448/09-69",
        raw_json: {
          รายการ: "โอนเงิน",
          รายละเอียด: "โอนไป X3992 หจก. ซีลเซ็นเตอ++",
        },
      }),
    ).toBe("หจก.ซีลเซ็นเตอร์");
  });
});
