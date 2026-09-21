import { formatBaht } from "@/lib/bi/sales-format";
import type { TigerPayDailyRollup } from "@/lib/bank/tiger-pay-daily";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const TIGER_PAY_REPORT_NOTES = [
  {
    term: "เงินสดรับเข้า",
    meaning: "เงินลูกค้าที่ชำระเป็นเงินสดผ่านเครื่อง Tiger (นับจากยอดเงินในเครื่อง)",
  },
  {
    term: "QR / PromptPay",
    meaning: "เงินลูกค้าที่ชำระออนไลน์ (ไม่ผ่าน hopper)",
  },
  {
    term: "เงินถอนออก",
    meaning: "เงินที่จ่ายออกให้ลูกค้าจากการทอน",
  },
  {
    term: "จ่ายคืนลูกค้า (CN)",
    meaning: "เงินที่จ่ายออกจากเครื่อง เพื่อคืนลูกค้า (ยกเลิก / คืนสินค้า)",
  },
  {
    term: "เงินสดรับสุทธิวันนี้",
    meaning: "เงินสดจากการขายวันนี้ หักเงินถอนและที่จ่ายคืนในเครื่อง",
  },
  {
    term: "ยอดรับชำระสุทธิ",
    meaning: "ยอดเงินที่รับเข้าทั้งหมด หักถอนและจ่ายคืนลูกค้า",
  },
] as const;

export function formatReportDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function isoDateToLocalDate(iso: string): Date | undefined {
  const match = ISO_DATE.exec(iso);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function localDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatReportBaht(value: number, precise = true): string {
  return formatBaht(value, precise);
}

export type TigerPayReportChartRow = {
  key: "cashIn" | "changeOut" | "qr" | "cn";
  label: string;
  value: number;
  fill: string;
};

export function tigerPayReportChartRows(
  today: Pick<
    TigerPayDailyRollup,
    "cashIn" | "changeOut" | "qrPromptpayIn" | "voucherUsedAmount"
  >
): TigerPayReportChartRow[] {
  return [
    {
      key: "cashIn",
      label: "เงินสดรับเข้า",
      value: today.cashIn,
      fill: "#22c55e",
    },
    {
      key: "changeOut",
      label: "เงินถอนออก",
      value: today.changeOut,
      fill: "#fb7185",
    },
    {
      key: "qr",
      label: "QR / PromptPay",
      value: today.qrPromptpayIn,
      fill: "#3b82f6",
    },
    {
      key: "cn",
      label: "จ่ายคืนลูกค้า (CN)",
      value: today.voucherUsedAmount,
      fill: "#6366f1",
    },
  ];
}
