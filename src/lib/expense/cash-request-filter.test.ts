import { describe, expect, it } from "vitest";

import type { ExpenseCashRequest } from "@/lib/expense/cash-request";
import {
  bangkokDateKey,
  canUpdateExpenseCashAccounting,
  EMPTY_EXPENSE_CASH_FILTERS,
  filterExpenseCashRequests,
  summarizeExpenseCashRequests,
} from "@/lib/expense/cash-request-filter";

function row(
  patch: Partial<ExpenseCashRequest> & Pick<ExpenseCashRequest, "id" | "short_code">
): ExpenseCashRequest {
  return {
    requester_line_user_id: "U1",
    requester_name: "สมชาย",
    reason: "ค่าขนส่ง",
    extra_reason: null,
    amount: 100,
    status: "paid",
    admin_note: null,
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    voucher_attempt_id: null,
    qr_image_url: null,
    branch: "HQ",
    paid_at: "2026-11-24T03:00:00.000Z",
    accounting_status: "pending",
    accounting_by: null,
    accounting_by_name: null,
    accounting_at: null,
    accounting_skip_reason: null,
    accounting_skip_note: null,
    created_at: "2026-11-23T10:00:00.000Z",
    updated_at: "2026-11-24T03:00:00.000Z",
    ...patch,
  };
}

describe("bangkokDateKey", () => {
  it("maps UTC midnight-adjacent times into Bangkok calendar dates", () => {
    expect(bangkokDateKey("2026-11-23T17:30:00.000Z")).toBe("2026-11-24");
    expect(bangkokDateKey("2026-11-23T16:59:00.000Z")).toBe("2026-11-23");
  });
});

describe("filterExpenseCashRequests", () => {
  const rows = [
    row({
      id: "a",
      short_code: 10,
      requester_name: "สมชาย",
      reason: "ค่าขนส่ง PL",
      amount: 1430,
      branch: "HQ",
      accounting_status: "pending",
      paid_at: "2026-11-24T03:00:00.000Z",
    }),
    row({
      id: "b",
      short_code: 11,
      requester_name: "สมหญิง",
      reason: "ค่าน้ำมัน",
      amount: 500,
      branch: "SYP",
      status: "approved",
      accounting_status: "pending",
      paid_at: null,
    }),
    row({
      id: "c",
      short_code: 12,
      requester_name: "สมชาย",
      reason: "ค่าน้ำ",
      amount: 200,
      branch: "HQ",
      accounting_status: "recorded",
      paid_at: "2026-11-20T04:00:00.000Z",
    }),
  ];

  it("searches short code, requester, and detail", () => {
    expect(
      filterExpenseCashRequests(rows, {
        ...EMPTY_EXPENSE_CASH_FILTERS,
        query: "10",
      }).map((r) => r.id)
    ).toEqual(["a"]);
    expect(
      filterExpenseCashRequests(rows, {
        ...EMPTY_EXPENSE_CASH_FILTERS,
        query: "สมหญิง",
      }).map((r) => r.id)
    ).toEqual(["b"]);
    expect(
      filterExpenseCashRequests(rows, {
        ...EMPTY_EXPENSE_CASH_FILTERS,
        query: "น้ำมัน",
      }).map((r) => r.id)
    ).toEqual(["b"]);
  });

  it("filters by paid date range, branch, status, and accounting", () => {
    expect(
      filterExpenseCashRequests(rows, {
        ...EMPTY_EXPENSE_CASH_FILTERS,
        paidFrom: "2026-11-24",
        paidTo: "2026-11-24",
      }).map((r) => r.id)
    ).toEqual(["a"]);
    expect(
      filterExpenseCashRequests(rows, {
        ...EMPTY_EXPENSE_CASH_FILTERS,
        branch: "SYP",
      }).map((r) => r.id)
    ).toEqual(["b"]);
    expect(
      filterExpenseCashRequests(rows, {
        ...EMPTY_EXPENSE_CASH_FILTERS,
        status: "paid",
        accountingStatus: "recorded",
      }).map((r) => r.id)
    ).toEqual(["c"]);
  });
});

describe("summarizeExpenseCashRequests", () => {
  it("counts rows and sums amounts", () => {
    expect(
      summarizeExpenseCashRequests([
        row({ id: "a", short_code: 1, amount: 100 }),
        row({ id: "b", short_code: 2, amount: 250.4 }),
      ])
    ).toEqual({
      count: 2,
      totalAmount: 350.4,
      pendingAccountingCount: 2,
      pendingAccountingAmount: 350.4,
    });
  });

  it("excludes skipped and recorded from pending accounting totals", () => {
    expect(
      summarizeExpenseCashRequests([
        row({
          id: "a",
          short_code: 1,
          amount: 100,
          accounting_status: "pending",
        }),
        row({
          id: "b",
          short_code: 2,
          amount: 200,
          accounting_status: "recorded",
        }),
        row({
          id: "c",
          short_code: 3,
          amount: 300,
          accounting_status: "skipped",
          accounting_skip_reason: "system_test",
        }),
        row({
          id: "d",
          short_code: 4,
          amount: 50,
          status: "approved",
          paid_at: null,
          accounting_status: "pending",
        }),
      ])
    ).toEqual({
      count: 4,
      totalAmount: 650,
      pendingAccountingCount: 1,
      pendingAccountingAmount: 100,
    });
  });
});

describe("canUpdateExpenseCashAccounting", () => {
  it("allows only paid rows", () => {
    expect(
      canUpdateExpenseCashAccounting(row({ id: "a", short_code: 1, status: "paid" }))
    ).toBe(true);
    expect(
      canUpdateExpenseCashAccounting(
        row({ id: "b", short_code: 2, status: "approved" })
      )
    ).toBe(false);
  });
});
