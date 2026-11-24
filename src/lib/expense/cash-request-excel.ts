import * as XLSX from "xlsx";

import {
  EXPENSE_CASH_ACCOUNTING_LABEL,
  EXPENSE_CASH_STATUS_LABEL,
  expenseCashAccountingSkipText,
  expenseCashDetailText,
  type ExpenseCashRequest,
} from "@/lib/expense/cash-request";
import { formatExpenseCashDateTime } from "@/lib/expense/cash-request-filter";

function excelRows(rows: ExpenseCashRequest[]) {
  return [
    [
      "เลขที่คำขอ",
      "วันที่สร้าง",
      "วันที่ถอนเงิน",
      "สาขา",
      "ผู้เบิก",
      "รายละเอียดค่าใช้จ่าย",
      "จำนวนเงิน",
      "สถานะการเบิกเงิน",
      "สถานะการลงค่าใช้จ่าย",
      "เหตุผลไม่ลงค่าใช้จ่าย",
      "ผู้ลงค่าใช้จ่าย",
      "วันเวลาที่ลงค่าใช้จ่าย",
    ],
    ...rows.map((row) => [
      row.short_code,
      formatExpenseCashDateTime(row.created_at),
      formatExpenseCashDateTime(row.paid_at),
      row.branch ?? "",
      row.requester_name || row.requester_line_user_id,
      expenseCashDetailText(row),
      Number(row.amount) || 0,
      EXPENSE_CASH_STATUS_LABEL[row.status] ?? row.status,
      EXPENSE_CASH_ACCOUNTING_LABEL[row.accounting_status] ??
        row.accounting_status,
      expenseCashAccountingSkipText(row) ?? "",
      row.accounting_by_name ?? "",
      formatExpenseCashDateTime(row.accounting_at),
    ]),
  ];
}

export function buildExpenseCashExcelBuffer(
  rows: ExpenseCashRequest[]
): ArrayBuffer {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(excelRows(rows));
  XLSX.utils.book_append_sheet(book, sheet, "คำขอเบิกเงินสด");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function expenseCashExcelFilename(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `expense_cash_requests_${y}${m}${d}.xlsx`;
}

export function downloadExpenseCashExcel(rows: ExpenseCashRequest[]): void {
  const buffer = buildExpenseCashExcelBuffer(rows);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = expenseCashExcelFilename();
  a.click();
  URL.revokeObjectURL(url);
}
