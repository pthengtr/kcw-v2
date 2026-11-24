export type ExpenseCashStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"
  | "cancelled"
  | "paid";

export type ExpenseCashAccountingStatus = "pending" | "recorded";

export type ExpenseCashBranch = "HQ" | "SYP";

export type ExpenseCashRequest = {
  id: string;
  short_code: number;
  requester_line_user_id: string;
  requester_name: string | null;
  reason: string;
  extra_reason: string | null;
  amount: number;
  status: ExpenseCashStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  voucher_attempt_id: string | null;
  qr_image_url: string | null;
  branch: ExpenseCashBranch | null;
  paid_at: string | null;
  accounting_status: ExpenseCashAccountingStatus;
  accounting_by: string | null;
  accounting_by_name: string | null;
  accounting_at: string | null;
  created_at: string;
  updated_at: string;
};

export const EXPENSE_CASH_STATUS_LABEL: Record<ExpenseCashStatus, string> = {
  pending: "รออนุมัติ",
  needs_info: "รอข้อมูลเพิ่ม",
  approved: "อนุมัติแล้ว (รอถอน)",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
  paid: "ถอนแล้ว",
};

export const EXPENSE_CASH_ACCOUNTING_LABEL: Record<
  ExpenseCashAccountingStatus,
  string
> = {
  pending: "รอลงค่าใช้จ่าย",
  recorded: "ลงค่าใช้จ่ายแล้ว",
};

export const EXPENSE_CASH_BRANCH_LABEL: Record<ExpenseCashBranch, string> = {
  HQ: "HQ",
  SYP: "SYP",
};

export type ExpenseCashVoucher = {
  attempt_id: string | null;
  status: string | null;
  voucher_num: string | null;
  amount: number | null;
  raw_status: string | null;
};

export const EXPENSE_CASH_VOUCHER_STATUS_LABEL: Record<string, string> = {
  creating: "กำลังสร้าง",
  pending: "รอสแกนถอน",
  used: "ถอนแล้ว",
  cancelled: "ยกเลิก voucher",
  expired: "หมดอายุ",
  failed: "สร้างไม่สำเร็จ",
};

export function formatBaht(amount: number): string {
  return `${Math.round(Number(amount) || 0).toLocaleString("th-TH")} บาท`;
}

export function formatBahtNumber(amount: number): string {
  return Math.round(Number(amount) || 0).toLocaleString("th-TH");
}

export function expenseCashDetailText(row: ExpenseCashRequest): string {
  return [row.reason, row.extra_reason].filter(Boolean).join(" · ");
}

export function expenseCashDisplayDate(row: ExpenseCashRequest): string | null {
  return row.paid_at || row.created_at || null;
}

export function normalizeExpenseCashRequest(
  row: Partial<ExpenseCashRequest> & {
    id: string;
    short_code: number;
    amount: number;
    status: ExpenseCashStatus;
    created_at: string;
    updated_at: string;
  }
): ExpenseCashRequest {
  return {
    id: row.id,
    short_code: row.short_code,
    requester_line_user_id: row.requester_line_user_id ?? "",
    requester_name: row.requester_name ?? null,
    reason: row.reason ?? "",
    extra_reason: row.extra_reason ?? null,
    amount: Number(row.amount) || 0,
    status: row.status,
    admin_note: row.admin_note ?? null,
    reviewed_by: row.reviewed_by ?? null,
    reviewed_by_name: row.reviewed_by_name ?? null,
    reviewed_at: row.reviewed_at ?? null,
    voucher_attempt_id: row.voucher_attempt_id ?? null,
    qr_image_url: row.qr_image_url ?? null,
    branch: row.branch === "HQ" || row.branch === "SYP" ? row.branch : null,
    paid_at: row.paid_at ?? null,
    accounting_status:
      row.accounting_status === "recorded" ? "recorded" : "pending",
    accounting_by: row.accounting_by ?? null,
    accounting_by_name: row.accounting_by_name ?? null,
    accounting_at: row.accounting_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
