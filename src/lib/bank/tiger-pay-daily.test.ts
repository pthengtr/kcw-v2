import { describe, expect, it } from "vitest";

import {
  parseDenomList,
  paymentCashList,
  paymentChangeList,
  paymentObject,
} from "@/lib/bank/tiger-pay-format";
import {
  hopperItemCounts,
  mapCashSnapshot,
  rollupTigerPayDay,
} from "@/lib/bank/tiger-pay-daily";
import type { TigerPayTransaction } from "@/lib/bank/tiger-pay-types";

function txn(
  overrides: Partial<TigerPayTransaction> & { payload: unknown }
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
    tiger_created_at: "2026-09-20T09:30:47+07:00",
    tiger_updated_at: "2026-09-20T09:31:24+07:00",
    first_received_at: "2026-09-20T02:31:24Z",
    last_received_at: "2026-09-20T02:31:24Z",
    last_event_id: null,
    ...overrides,
  };
}

describe("Tiger Pay denom parsers", () => {
  it("reads live webhook cashList and change.cashList", () => {
    const payload = {
      payment: {
        cashList: [{ value: 1000, amount: 1, createdAt: "2026-09-20T09:31:07" }],
        change: {
          amount: 780,
          cashList: [
            { type: "Banknote", value: 500, amount: 1, currency: "THB" },
            { type: "Banknote", value: 100, amount: 2, currency: "THB" },
            { type: "Banknote", value: 50, amount: 1, currency: "THB" },
            { type: "Banknote", value: 20, amount: 1, currency: "THB" },
            { type: "Coin", value: 10, amount: 1, currency: "THB" },
          ],
        },
      },
    };
    const payment = paymentObject(payload);
    expect(paymentCashList(payment)).toEqual([
      { value: 1000, amount: 1, kind: "Banknote" },
    ]);
    expect(paymentChangeList(payment).map((row) => `${row.value}x${row.amount}`)).toEqual([
      "500x1",
      "100x2",
      "50x1",
      "20x1",
      "10x1",
    ]);
    expect(parseDenomList([{ denomination: 20, quantity: 2 }])).toEqual([
      { value: 20, amount: 2, kind: "Banknote" },
    ]);
  });
});

describe("Tiger Pay daily rollup", () => {
  it("rolls up cash-in, change, unspecified exact cash, and QR", () => {
    const rows = [
      txn({
        tiger_payment_id: 29,
        payment_no: "PA2609200029",
        amount: 220,
        total_pay: 1000,
        change_amount: 780,
        payload: {
          payment: {
            cashList: [{ value: 1000, amount: 1 }],
            change: {
              cashList: [
                { type: "Banknote", value: 500, amount: 1 },
                { type: "Banknote", value: 100, amount: 2 },
                { type: "Banknote", value: 50, amount: 1 },
                { type: "Banknote", value: 20, amount: 1 },
                { type: "Coin", value: 10, amount: 1 },
              ],
            },
          },
        },
      }),
      txn({
        tiger_payment_id: 28,
        payment_no: "PA2609200028",
        amount: 2188,
        total_pay: 2188,
        change_amount: 0,
        payload: { payment: { cashList: [] } },
      }),
      txn({
        tiger_payment_id: 30,
        payment_no: "PA2609200030",
        payment_type: "qr",
        amount: 490,
        total_pay: 490,
        change_amount: 0,
        payload: { payment: { cashList: [] } },
      }),
    ];

    const rollup = rollupTigerPayDay({
      date: "2026-09-20",
      shopCode: "1",
      transactions: rows,
      attempts: [
        {
          tiger_payment_id: 29,
          pos_bill_number: "6K69-0011200",
          submitted_by_name: "Aon",
          amount: "220.00",
        },
        {
          tiger_payment_id: 28,
          pos_bill_number: "TR6909-039",
          submitted_by_name: "Aon",
          amount: "2188.10",
        },
      ],
      vouchers: [
        {
          id: "v-used",
          pos_bill_number: "KCN6908-0282",
          voucher_num: "922676492477",
          amount: 180,
          status: "used",
          submitted_by_name: "หนุ่ย",
          created_at: "2026-09-20T10:41:40+07:00",
          updated_at: "2026-09-20T10:44:25+07:00",
        },
        {
          id: "v-cancel",
          pos_bill_number: "KCN6908-0280",
          voucher_num: "527032262695",
          amount: 95,
          status: "cancelled",
          created_at: "2026-09-20T09:32:11+07:00",
        },
      ],
    });

    expect(rollup.billed).toBe(2898);
    expect(rollup.posBilled).toBe(2898.1);
    expect(rollup.cashFloorRemainder).toBe(0.1);
    expect(rollup.flooredBills).toEqual([
      {
        posBillNumber: "TR6909-039",
        paymentNo: "PA2609200028",
        posAmount: 2188.1,
        tigerAmount: 2188,
        remainder: 0.1,
      },
    ]);
    expect(rollup.cashIn).toBe(3188);
    expect(rollup.changeOut).toBe(780);
    expect(rollup.cashNet).toBe(2408);
    expect(rollup.qrPromptpayIn).toBe(490);
    expect(rollup.denomIn["1000"]).toBe(1);
    expect(rollup.denomOut["100"]).toBe(2);
    expect(rollup.unspecifiedIn).toBe(2188);
    expect(rollup.successCount).toBe(3);
    expect(rollup.bills[0]?.posBillNumber ?? rollup.bills.find((b) => b.paymentNo === "PA2609200029")?.posBillNumber).toBe(
      "6K69-0011200"
    );
    expect(rollup.bills.find((b) => b.posBillNumber === "TR6909-039")).toMatchObject({
      amount: 2188,
      posAmount: 2188.1,
      cashFloorRemainder: 0.1,
    });
    expect(rollup.exceptions.some((row) => row.paymentNo === "PA2609200028")).toBe(
      true
    );
    expect(rollup.voucherUsedCount).toBe(1);
    expect(rollup.voucherUsedAmount).toBe(180);
    expect(rollup.voucherCancelledCount).toBe(1);
    expect(rollup.vouchers.map((row) => row.posBillNumber)).toEqual([
      "KCN6908-0282",
      "KCN6908-0280",
    ]);
  });

  it("does not net +cancel then −redeem on the same CN", () => {
    const rollup = rollupTigerPayDay({
      date: "2026-09-20",
      shopCode: "1",
      transactions: [],
      vouchers: [
        {
          id: "v-cancel-95",
          pos_bill_number: "KCN6908-0280",
          voucher_num: "527032262695",
          amount: 95,
          status: "cancelled",
          created_at: "2026-09-20T09:32:11+07:00",
          updated_at: "2026-09-20T09:37:56+07:00",
        },
        {
          id: "v-used-95",
          pos_bill_number: "KCN6908-0280",
          voucher_num: "554434252406",
          amount: 95,
          status: "used",
          created_at: "2026-09-20T09:39:20+07:00",
          updated_at: "2026-09-20T10:49:59+07:00",
        },
        {
          id: "v-used-650",
          pos_bill_number: "KCN6908-0281",
          voucher_num: "919306979112",
          amount: 650,
          status: "used",
          created_at: "2026-09-20T09:46:18+07:00",
          updated_at: "2026-09-20T10:59:08+07:00",
        },
        {
          id: "v-used-180",
          pos_bill_number: "KCN6908-0282",
          voucher_num: "922676492477",
          amount: 180,
          status: "used",
          created_at: "2026-09-20T10:41:40+07:00",
          updated_at: "2026-09-20T10:44:25+07:00",
        },
      ],
    });

    expect(rollup.voucherUsedCount).toBe(3);
    expect(rollup.voucherUsedAmount).toBe(925);
    expect(rollup.voucherCancelledCount).toBe(0);
    expect(
      rollup.vouchers.find((row) => row.voucherNum === "527032262695")?.superseded
    ).toBe(true);
    expect(
      rollup.vouchers.find((row) => row.voucherNum === "554434252406")?.superseded
    ).toBe(false);
  });
});

describe("Tiger Pay snapshot mapping", () => {
  it("maps hopper snapshot rows and piece counts", () => {
    const snapshot = mapCashSnapshot({
      id: "snap-1",
      captured_at: "2026-09-20T10:00:00+07:00",
      biz_day: "2026-09-20",
      trigger: "webhook",
      change_ready: true,
      change_level: "orange",
      change_reasons: ["ธนบัตร 20 เหลือ 5 ใบ"],
      items: [
        { type: "Banknote", value: 20, amount: 5 },
        { type: "Coin", value: 10, amount: 12 },
      ],
      total_baht: 220,
      shop_code: "1",
    });
    expect(snapshot?.change_level).toBe("orange");
    expect(hopperItemCounts(snapshot?.items)["20"]).toBe(5);
    expect(hopperItemCounts(snapshot?.items)["10"]).toBe(12);
  });
});
