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
  approved: "อนุมัติแล้ว (รอถอน)",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
  paid: "ถอนแล้ว",
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
