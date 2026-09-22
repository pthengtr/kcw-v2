import { describe, expect, it } from "vitest";

import {
  parseDenomList,
  paymentCashList,
  paymentChangeList,
  paymentObject,
} from "@/lib/bank/tiger-pay-format";
import {
  classifyVoucherCash,
  hopperItemCounts,
  mapCashSnapshot,
  rollupTigerPayDay,
  voucherCashMoved,
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
    expect(rollup.billedNet).toBe(2718);
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
    expect(rollup.cashNet).toBe(2228);
    expect(rollup.qrPromptpayIn).toBe(490);
    expect(rollup.settledNet).toBe(2718);
    expect(rollup.cashSuccessCount).toBe(2);
    expect(rollup.qrSuccessCount).toBe(1);
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
    expect(rollup.vouchers.find((row) => row.voucherNum === "527032262695")).toMatchObject({
      cashMoved: 0,
      cashDirection: "none",
    });
    expect(rollup.vouchers.find((row) => row.voucherNum === "922676492477")).toMatchObject({
      cashMoved: 180,
      cashDirection: "out",
    });
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
          raw_status: "cancelled",
          raw_last_show: {
            voucher: { note: "cancelled", used: 1, amount: 95, balance: 95 },
          },
          created_at: "2026-09-20T09:32:11+07:00",
          updated_at: "2026-09-20T09:37:56+07:00",
        },
        {
          id: "v-used-95",
          pos_bill_number: "KCN6908-0280",
          voucher_num: "554434252406",
          amount: 95,
          status: "used",
          raw_status: "1",
          raw_last_show: {
            voucher: {
              note: "CN bill KCN6908-0280",
              used: 1,
              amount: 95,
              balance: 0,
            },
          },
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
    expect(rollup.billed).toBe(0);
    expect(rollup.billedNet).toBe(-925);
    expect(rollup.cashNet).toBe(-925);
    expect(rollup.vouchers.find((row) => row.voucherNum === "527032262695")).toMatchObject({
      cashMoved: 0,
      superseded: true,
    });
    expect(rollup.vouchers.find((row) => row.voucherNum === "554434252406")).toMatchObject({
      cashMoved: 95,
      superseded: false,
    });
  });

  it("counts only cash-moving CN / cancel CN from today's live rows", () => {
    const rollup = rollupTigerPayDay({
      date: "2026-09-20",
      shopCode: "1",
      transactions: [
        txn({
          tiger_payment_id: 40,
          payment_no: "PA40",
          amount: 1000,
          total_pay: 1000,
          payload: { payment: { cashList: [{ value: 1000, amount: 1 }] } },
        }),
      ],
      vouchers: [
        {
          id: "v-0279",
          pos_bill_number: "KCN6908-0279",
          amount: 620,
          status: "cancelled",
          raw_status: "cancelled",
          raw_last_show: {
            voucher: { note: "cancelled", used: 1, amount: 620, balance: 620 },
          },
          created_at: "2026-09-20T07:06:13+07:00",
        },
        {
          id: "v-8k",
          pos_bill_number: "8K69-0017076",
          amount: 400,
          status: "cancelled",
          raw_status: "cancelled",
          raw_last_show: {
            voucher: { note: "cancelled", used: 1, amount: 400, balance: 400 },
          },
          created_at: "2026-09-20T08:10:36+07:00",
        },
        {
          id: "v-0280-cancel",
          pos_bill_number: "KCN6908-0280",
          amount: 95,
          status: "cancelled",
          raw_status: "cancelled",
          raw_last_show: {
            voucher: { note: "cancelled", used: 1, amount: 95, balance: 95 },
          },
          created_at: "2026-09-20T09:32:11+07:00",
        },
        {
          id: "v-0280-used",
          pos_bill_number: "KCN6908-0280",
          amount: 95,
          status: "used",
          raw_status: "1",
          raw_last_show: {
            voucher: {
              note: "CN bill KCN6908-0280",
              used: 1,
              amount: 95,
              balance: 0,
            },
          },
          created_at: "2026-09-20T09:39:20+07:00",
        },
        {
          id: "v-0281",
          pos_bill_number: "KCN6908-0281",
          amount: 650,
          status: "used",
          raw_status: "1",
          raw_last_show: {
            voucher: {
              note: "CN bill KCN6908-0281",
              used: 1,
              amount: 650,
              balance: 0,
            },
          },
          created_at: "2026-09-20T09:46:18+07:00",
        },
        {
          id: "v-0282",
          pos_bill_number: "KCN6908-0282",
          amount: 180,
          status: "used",
          created_at: "2026-09-20T10:41:40+07:00",
        },
        {
          id: "v-0283",
          pos_bill_number: "KCN6908-0283",
          amount: 840,
          status: "used",
          raw_status: "1",
          raw_last_show: {
            voucher: {
              note: "CN bill KCN6908-0283",
              used: 1,
              amount: 840,
              balance: 0,
            },
          },
          created_at: "2026-09-20T12:32:38+07:00",
        },
      ],
    });

    expect(rollup.voucherUsedCount).toBe(4);
    expect(rollup.voucherUsedAmount).toBe(1765);
    expect(rollup.voucherCancelledCount).toBe(2);
    expect(rollup.billedNet).toBe(-765);
    expect(rollup.cashNet).toBe(-765);
  });

  it("never treats a cancelled CN as cash back into the machine", () => {
    const rollup = rollupTigerPayDay({
      date: "2026-09-20",
      shopCode: "1",
      transactions: [
        txn({
          tiger_payment_id: 40,
          payment_no: "PA40",
          amount: 1000,
          total_pay: 1000,
          payload: { payment: { cashList: [{ value: 1000, amount: 1 }] } },
        }),
      ],
      vouchers: [
        {
          id: "v-cancel-before-voucher",
          pos_bill_number: "KCN6908-0299",
          amount: 200,
          status: "cancelled",
          raw_status: "cancelled",
          raw_last_show: {
            voucher: { note: "cancelled", used: 1, amount: 200, balance: 0 },
          },
          created_at: "2026-09-20T11:00:00+07:00",
        },
      ],
    });
    expect(rollup.voucherUsedAmount).toBe(0);
    expect(rollup.voucherCancelledCount).toBe(1);
    expect(rollup.cashNet).toBe(1000);
    expect(rollup.billedNet).toBe(1000);
    expect(rollup.vouchers[0]).toMatchObject({
      cashMoved: 0,
      cashDirection: "none",
    });
  });

  it("does not move the day total when a CN voucher is only cancelled", () => {
    const rollup = rollupTigerPayDay({
      date: "2026-09-20",
      shopCode: "1",
      transactions: [
        txn({
          tiger_payment_id: 40,
          payment_no: "PA40",
          amount: 1000,
          total_pay: 1000,
          payload: { payment: { cashList: [{ value: 1000, amount: 1 }] } },
        }),
      ],
      vouchers: [
        {
          id: "v-cancel-only",
          pos_bill_number: "KCN6908-0279",
          amount: 620,
          status: "cancelled",
          created_at: "2026-09-20T07:06:13+07:00",
        },
      ],
    });
    expect(rollup.billed).toBe(1000);
    expect(rollup.billedNet).toBe(1000);
    expect(rollup.voucherUsedAmount).toBe(0);
    expect(rollup.voucherCancelledCount).toBe(1);
    expect(rollup.vouchers[0]?.cashMoved).toBe(0);
  });
});

describe("voucher cashbox payout", () => {
  it("treats Tiger used=1 + note=cancelled + leftover balance as no cash moved", () => {
    expect(
      classifyVoucherCash({
        amount: 95,
        status: "cancelled",
        raw_status: "cancelled",
        raw_last_show: {
          voucher: { note: "cancelled", used: 1, amount: 95, balance: 95 },
        },
      })
    ).toEqual({ direction: "none", amount: 0 });
    expect(
      voucherCashMoved({
        amount: 95,
        status: "cancelled",
        raw_status: "cancelled",
        raw_last_show: {
          voucher: { note: "cancelled", used: 1, amount: 95, balance: 95 },
        },
      })
    ).toBe(0);
  });

  it("treats used=1 and balance 0 as cash paid", () => {
    expect(
      classifyVoucherCash({
        amount: 95,
        status: "used",
        raw_status: "1",
        raw_last_show: {
          voucher: { note: "CN bill KCN6908-0280", used: 1, amount: 95, balance: 0 },
        },
      })
    ).toEqual({ direction: "out", amount: 95 });
  });

  it("treats any cancelled CN as no cash, including used=1 leftovers", () => {
    expect(
      classifyVoucherCash({
        amount: 200,
        status: "cancelled",
        raw_last_show: {
          voucher: { note: "cancelled", used: 1, amount: 200, balance: 0 },
        },
      })
    ).toEqual({ direction: "none", amount: 0 });
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
      cash_box_items: [{ type: "Banknote", value: 1000, amount: 228 }],
      cash_box_total_baht: 228000,
      shop_code: "1",
    });
    expect(snapshot?.change_level).toBe("orange");
    expect(hopperItemCounts(snapshot?.items)["20"]).toBe(5);
    expect(hopperItemCounts(snapshot?.items)["10"]).toBe(12);
    expect(snapshot?.cash_box_total_baht).toBe(228000);
    expect(hopperItemCounts(snapshot?.cash_box_items)["1000"]).toBe(228);
  });

  it("defaults missing cash_box fields to empty", () => {
    const snapshot = mapCashSnapshot({
      id: "snap-2",
      captured_at: "2026-09-20T10:00:00+07:00",
      biz_day: "2026-09-20",
      trigger: "manual",
      change_ready: true,
      change_level: "green",
      change_reasons: [],
      items: [],
      total_baht: 0,
      shop_code: "1",
    });
    expect(snapshot?.cash_box_items).toEqual([]);
    expect(snapshot?.cash_box_total_baht).toBe(0);
  });
});
