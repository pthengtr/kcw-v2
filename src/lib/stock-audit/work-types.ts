const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accept YYYY-MM-DD calendar dates; reject impossible days like 2026-02-31. */
export function parseStockWorkAsOf(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return undefined;
  const [year, month, day] = trimmed.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return trimmed;
}

export type StockWorkEventType =
  | "count_correct"
  | "count_variance"
  | "count_edit"
  | "audit_approve"
  | "audit_reject";

export type StockWorkCounts = {
  count_correct: number;
  count_variance: number;
  count_edit: number;
  audit_approve: number;
  audit_reject: number;
  total_actions: number;
  /** count_correct + count_variance — daily target progress */
  completed_counts: number;
};

export type StockWorkDaily = StockWorkCounts & {
  date: string;
};

export type StockWorkOperator = {
  line_user_id: string;
  display_name: string;
  today: StockWorkCounts;
  week: StockWorkCounts;
};

export type StockWorkKpi = {
  branch: "HQ" | "SYP";
  as_of: string;
  today: string;
  summary_today: StockWorkCounts;
  summary_week: StockWorkCounts;
  daily: StockWorkDaily[];
  operators: StockWorkOperator[];
};

export const STOCK_WORK_EVENT_META: {
  key: StockWorkEventType;
  label: string;
  hint: string;
}[] = [
  {
    key: "count_correct",
    label: "นับตรง",
    hint: "นับแล้วตรงกับระบบ",
  },
  {
    key: "count_variance",
    label: "นับคลาด",
    hint: "นับแล้วไม่ตรง · รอตรวจ",
  },
  {
    key: "count_edit",
    label: "แก้ไข",
    hint: "แก้จำนวนก่อนอนุมัติ",
  },
  {
    key: "audit_approve",
    label: "อนุมัติ",
    hint: "ตรวจรับ variance",
  },
  {
    key: "audit_reject",
    label: "ปฏิเสธ",
    hint: "ปฏิเสธ draft",
  },
];
