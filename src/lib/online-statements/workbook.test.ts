import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { validateOnlineWorkbook } from "@/lib/online-statements/workbook";

function book(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
}

describe("online statement workbook format", () => {
  it("accepts a Lazada transaction overview and rejects another sheet", () => {
    const good = book({
      "Transaction Overview": [
        ["Amount", "Statement", "Paid Status", "Order No.", "Fee Name", "Transaction Type"],
        [10, "20 Sep 2026 - 20 Sep 2026", "paid", "1118594800859773", "Item Price Credit", "Orders-Sales"],
      ],
    });
    expect(validateOnlineWorkbook(good, "lazada")).toEqual({ ok: true, rowCount: 1 });

    const bad = book({ Sheet1: [["hello"]] });
    expect(validateOnlineWorkbook(bad, "lazada").ok).toBe(false);
  });

  it("accepts a Shopee transaction report and rejects a file without the header", () => {
    const good = book({
      "Transaction Report": [
        ["รายงาน"],
        ["วันที่", "ประเภทการทำธุรกรรม", "คำอธิบาย", "รหัสคำสั่งซื้อ", "รูปแบบธุรกรรม", "จำนวนเงิน", "สถานะ", "ยอด"],
        ["2026-09-15 01:45:10", "การถอนเงิน", "การถอนเงินอัตโนมัติ", "-", "เงินออก", -10, "ทำรายการสำเร็จ", 0],
      ],
    });
    expect(validateOnlineWorkbook(good, "shopee")).toEqual({ ok: true, rowCount: 1 });

    const bad = book({
      "Transaction Report": [["วันที่", "อย่างอื่น"]],
    });
    expect(validateOnlineWorkbook(bad, "shopee").ok).toBe(false);
  });

  it("accepts a TikTok order plus withdrawal workbook and rejects one missing the withdrawal sheet", () => {
    const good = book({
      รายละเอียดคำสั่งซื้อ: [
        ["หมายเลขคำสั่งซื้อ/การปรับ", "ประเภทธุรกรรม"],
        ["585982682407208429", "คำสั่งซื้อ"],
      ],
      บันทึกการถอน: [
        ["ประเภทธุรกรรม", "ID อ้างอิง", "จำนวน", "สถานะ"],
        ["Withdrawal", "3701", -80, "Transferred"],
      ],
    });
    expect(validateOnlineWorkbook(good, "tiktok")).toEqual({ ok: true, rowCount: 2 });

    const bad = book({
      รายละเอียดคำสั่งซื้อ: [
        ["หมายเลขคำสั่งซื้อ/การปรับ"],
        ["585982682407208429"],
      ],
    });
    expect(validateOnlineWorkbook(bad, "tiktok").ok).toBe(false);
  });

  it("accepts a Peak order list and rejects one without a platform", () => {
    const header = ["#", "วันที่คำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "มูลค่าคำสั่งซื้อ", "สถานะ", "วันที่ออกเอกสาร", "เลขที่เอกสาร", "สถานะเอกสาร", "มูลค่าเอกสาร", "", "แพลตฟอร์ม : ", "Shopee"];
    const good = book({
      รายการคำสั่งซื้อ: [
        header,
        ["1", "01/09/2026", "260901U5BDSGN4", "1236", "สำเร็จ", "01/09/2026", "RT-20260900044", "รับชำระแล้ว", "1236"],
      ],
    });
    expect(validateOnlineWorkbook(good, "peak")).toEqual({ ok: true, rowCount: 1 });

    const bad = book({
      รายการคำสั่งซื้อ: [
        ["#", "วันที่คำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "มูลค่า", "สถานะ", "วันที่", "เลขที่เอกสาร"],
        ["1", "01/09/2026", "260901U5BDSGN4", "1236", "สำเร็จ", "", "RT-1"],
      ],
    });
    expect(validateOnlineWorkbook(bad, "peak").ok).toBe(false);
  });
});
