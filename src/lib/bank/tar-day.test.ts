import { describe, expect, it } from "vitest";

import { summarizeTarDayBills, tarDayLookup } from "@/lib/bank/tar-day";

const hqRow = {
  account_no: "064-8-91723-6",
  match_status: "matched",
  match_reason: "ยอดขายสุทธิ TAR (เข้าวันถัดไป)",
  match_notes: "ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 01/05/2026",
  matched_ref_type: "tar_cntar_net",
  matched_ref_id: "2026-05-01",
};

describe("tarDayLookup", () => {
  it("opens HQ TAR bills for a matched daily net", () => {
    expect(tarDayLookup(hqRow)).toEqual({
      date: "2026-05-01",
      series: "hq",
      label: "ดูบิล TAR/CNTAR วันที่ 1 พ.ค.",
    });
  });

  it("opens SYP 3TAR bills from the match reason", () => {
    expect(
      tarDayLookup({
        ...hqRow,
        account_no: "064-8-92039-3",
        match_reason: "ยอดขายสุทธิ 3TAR (เข้าวันถัดไป)",
        match_notes: "ยอดขายสุทธิรายวัน (3TAR หัก 3CNTAR)",
        matched_ref_id: "01/05/2026",
      }),
    ).toMatchObject({ date: "2026-05-01", series: "syp" });
  });

  it("stays hidden until the row is matched to a sales date", () => {
    expect(tarDayLookup({ ...hqRow, match_status: "pending" })).toBeNull();
    expect(tarDayLookup({ ...hqRow, match_status: "unmatched" })).toBeNull();
    expect(tarDayLookup({ ...hqRow, match_status: "ignored" })).toBeNull();
    expect(tarDayLookup({ ...hqRow, matched_ref_id: null })).toBeNull();
    expect(tarDayLookup({ ...hqRow, matched_ref_type: "tr_bill" })).toBeNull();
  });
});

describe("summarizeTarDayBills", () => {
  it("adds CNTAR amounts that are already negative", () => {
    expect(
      summarizeTarDayBills([
        { doc_type: "TAR", billno: "TAR6905-001", amount: 1000 },
        { doc_type: "CNTAR", billno: "CNTAR6905-001", amount: -40.5 },
      ]),
    ).toEqual({ tar_total: 1000, cntar_total: -40.5, net: 959.5 });
  });
});
