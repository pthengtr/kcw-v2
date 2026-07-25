import type { BiSplitRow } from "./sales-types";

const thNumber = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
});

const thMoney = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const thMoneyPrecise = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBaht(value: number, precise = false): string {
  if (!Number.isFinite(value)) return "฿0";
  const abs = Math.abs(value);
  const body = precise ? thMoneyPrecise.format(abs) : thMoney.format(abs);
  return value < 0 ? `-฿${body}` : `฿${body}`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return thNumber.format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function pctChange(
  current: number,
  previous: number
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function shareOf(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total === 0) {
    return 0;
  }
  return (part / total) * 100;
}

export function splitAmount(
  rows: BiSplitRow[],
  key: string
): number {
  return rows.find((r) => r.key === key)?.revenue_net ?? 0;
}

export function splitCount(rows: BiSplitRow[], key: string): number {
  return rows.find((r) => r.key === key)?.bill_count ?? 0;
}

export const SALES_TYPE_LABELS: Record<string, string> = {
  VAT: "VAT",
  NON_VAT: "Non-VAT",
};

export const BRANCH_LABELS: Record<string, string> = {
  HQ: "HQ",
  SYP: "SYP",
  ONLINE: "ออนไลน์",
};

export const CHANNEL_LABELS: Record<string, string> = {
  ONLINE: "ออนไลน์",
  COUNTER: "หน้าร้าน",
};

export const BILLTYPE_LABELS: Record<string, string> = {
  UNKNOWN: "หน้าร้าน (K/C)",
  TAD: "ออนไลน์ (TAD)",
  TD: "เครดิต VAT (TD)",
  TR: "เงินสด VAT (TR)",
  CN: "ใบลดหนี้ (CN)",
  DN: "ใบเพิ่มหนี้ (DN)",
};

export function labelFor(
  map: Record<string, string>,
  key: string
): string {
  return map[key] ?? key;
}
