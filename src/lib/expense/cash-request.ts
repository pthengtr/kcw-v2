export type ExpenseCashStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"
  | "cancelled"
  | "paid";

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
  created_at: string;
  updated_at: string;
};

export const EXPENSE_CASH_STATUS_LABEL: Record<ExpenseCashStatus, string> = {
  pending: "รออนุมัติ",
  needs_info: "รอข้อมูลเพิ่ม",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
  paid: "ถอนแล้ว",
};

export function formatBaht(amount: number): string {
  return `${Math.round(Number(amount) || 0).toLocaleString("th-TH")} บาท`;
}
