import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  buildExpenseCashExcelBuffer,
  expenseCashExcelFilename,
} from "@/lib/expense/cash-request-excel";
import type { ExpenseCashRequest } from "@/lib/expense/cash-request";

const sample: ExpenseCashRequest = {
  id: "a",
  short_code: 10,
  requester_line_user_id: "U1",
  requester_name: "สมชาย",
  reason: "ค่าขนส่ง",
  extra_reason: "PL",
  amount: 1430,
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
  created_at: "2026-11-23T10:00:00.000Z",
  updated_at: "2026-11-24T03:00:00.000Z",
};

describe("expense cash excel", () => {
  it("builds an xlsx with request rows", () => {
    const buffer = buildExpenseCashExcelBuffer([sample]);
    const book = XLSX.read(buffer, { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]!];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
    });
    expect(rows[0]?.[0]).toBe("เลขที่คำขอ");
    expect(rows[1]?.[0]).toBe(10);
    expect(rows[1]?.[6]).toBe(1430);
  });

  it("names the file with a date stamp", () => {
    expect(expenseCashExcelFilename(new Date("2026-11-24T12:00:00Z"))).toBe(
      "expense_cash_requests_20261124.xlsx"
    );
  });
});
