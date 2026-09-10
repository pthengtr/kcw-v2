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
});
