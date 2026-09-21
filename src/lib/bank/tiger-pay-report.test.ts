import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { rollupTigerPayDay } from "@/lib/bank/tiger-pay-daily";
import type { TigerPayTransaction } from "@/lib/bank/tiger-pay-types";
import {
  formatReportBaht,
  formatReportDate,
  isoDateToLocalDate,
  localDateToIso,
  tigerPayReportChartRows,
  TIGER_PAY_REPORT_NOTES,
} from "@/lib/bank/tiger-pay-report";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function txn(
  overrides: Partial<TigerPayTransaction> & { payload?: unknown } = {}
): TigerPayTransaction {
  return {
    tiger_payment_id: 1,
    payment_no: "PA1",
    payment_type: "cash",
    status: "success",
    amount: 0,
    total_pay: 0,
    change_amount: 0,
    ref_no_1: null,
    ref_no_2: null,
    note: null,
    remark: null,
    shop_code: "1",
    shop_name: "HQ",
    branch_name: "HeadOffice",
    tiger_created_at: "2026-09-21T09:30:00+07:00",
    tiger_updated_at: "2026-09-21T09:30:00+07:00",
    first_received_at: "2026-09-21T02:30:00Z",
    last_received_at: "2026-09-21T02:30:00Z",
    last_event_id: null,
    payload: {},
    ...overrides,
  };
}

describe("Tiger Pay report date helpers", () => {
  it("formats Bangkok ISO dates as DD/MM/YYYY", () => {
    expect(formatReportDate("2026-09-21")).toBe("21/09/2026");
  });

  it("round-trips a local calendar date without timezone shift", () => {
    const date = isoDateToLocalDate("2026-09-21");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(21);
    expect(localDateToIso(date!)).toBe("2026-09-21");
  });
});

describe("Tiger Pay report formula", () => {
  it("matches the mock: cash + QR − change − CN = settled, cash − change − CN = cash net", () => {
    const rollup = rollupTigerPayDay({
      date: "2026-09-21",
      shopCode: "1",
      transactions: [
        txn({
          tiger_payment_id: 1,
          payment_type: "cash",
          amount: 27969,
          total_pay: 37980,
          change_amount: 10011,
          payload: { payment: { cashList: [{ value: 1000, amount: 38 }] } },
        }),
        txn({
          tiger_payment_id: 2,
          payment_no: "QR1",
          payment_type: "qr",
          amount: 31430,
          total_pay: 31430,
        }),
      ],
      vouchers: [
        {
          id: "v1",
          amount: 770,
          status: "used",
          created_at: "2026-09-21T10:00:00+07:00",
        },
      ],
    });

    expect(rollup.cashIn).toBe(37980);
    expect(rollup.qrPromptpayIn).toBe(31430);
    expect(rollup.changeOut).toBe(10011);
    expect(rollup.voucherUsedAmount).toBe(770);
    expect(rollup.cashNet).toBe(27199);
    expect(rollup.settledNet).toBe(58629);
    expect(rollup.cashSuccessCount).toBe(1);
    expect(rollup.qrSuccessCount).toBe(1);
    expect(rollup.settledNet).toBe(
      rollup.cashIn + rollup.qrPromptpayIn - rollup.changeOut - rollup.voucherUsedAmount
    );
    expect(formatReportBaht(rollup.settledNet)).toBe("฿58,629.00");
    expect(formatReportBaht(rollup.cashNet, false)).toBe("฿27,199");
  });

  it("builds chart rows in mock order: cash, change, QR, CN", () => {
    const rows = tigerPayReportChartRows({
      cashIn: 37980,
      changeOut: 10011,
      qrPromptpayIn: 31430,
      voucherUsedAmount: 770,
    });
    expect(rows.map((row) => row.key)).toEqual([
      "cashIn",
      "changeOut",
      "qr",
      "cn",
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      "เงินสดรับเข้า",
      "เงินถอนออก",
      "QR / PromptPay",
      "จ่ายคืนลูกค้า (CN)",
    ]);
  });
});

describe("Tiger Pay report page layout", () => {
  it("renders the mock dashboard sections on the daily report", () => {
    const page = read("src/components/bank/TigerPayPage.tsx");
    expect(page).toContain("TigerPayReportHeader");
    expect(page).toContain("รายงาน Tiger Pay");
    expect(page).toContain("onViewDetails");

    const header = read("src/components/bank/TigerPayReportHeader.tsx");
    expect(header).toContain("สรุปการรับ-จ่ายเงินสด และ QR / PromptPay ผ่านเครื่อง Tiger");
    expect(header).toContain("ปิดวัน (Z-report)");
    expect(header).toContain("วันนี้");

    const report = read("src/components/bank/TigerPayDailyReport.tsx");
    expect(report).toContain("สรุปยอดรับชำระวันนี้");
    expect(report).toContain("เงินเข้า – ออกวันนี้");
    expect(report).toContain("สรุปจำนวนรายการ");
    expect(report).toContain("เงินสดรับสุทธิวันนี้");
    expect(report).toContain("หมายเหตุ");
    expect(report).toContain("เงินถอนออก");
    expect(report).toContain("ยอดรับชำระสุทธิ");
    expect(report).toContain("ดูรายละเอียด");

    const daily = read("src/components/bank/TigerPayDailyStatus.tsx");
    expect(daily).toContain("TigerPayDailyReport");
    expect(daily).not.toContain("SalesKpiCard");
  });

  it("documents the mock glossary terms", () => {
    expect(TIGER_PAY_REPORT_NOTES.map((note) => note.term)).toEqual([
      "เงินสดรับเข้า",
      "QR / PromptPay",
      "เงินถอนออก",
      "จ่ายคืนลูกค้า (CN)",
      "เงินสดรับสุทธิวันนี้",
      "ยอดรับชำระสุทธิ",
    ]);
  });
});
