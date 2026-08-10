export type StockAuditBranch = "HQ" | "SYP";

export type StockAuditBucket =
  | "never"
  | "d30"
  | "d90"
  | "d180"
  | "d365"
  | "over_365";

export type StockAuditBatchItemStatus = "pending" | "done" | "skipped";

export type StockAuditMarkSource = "batch" | "ondemand" | "manual";

export type StockAuditSummary = {
  total: number;
  never_count: number;
  d30_count: number;
  d90_count: number;
  d180_count: number;
  d365_count: number;
  over_365_count: number;
  app_marked_count: number;
  marked_today_count: number;
  marked_week_count: number;
};

export type StockAuditDailyMark = {
  date: string;
  count: number;
};

export type StockAuditOperatorMark = {
  name: string;
  today_count: number;
  week_count: number;
};

export type StockAuditRow = {
  bcode: string;
  descr: string;
  brand: string;
  model: string;
  location1: string;
  category: string;
  qty: number;
  sell_qty_period: number;
  sell_revenue_period: number;
  pos_dateaudit: string | null;
  app_dateaudit: string | null;
  effective_date: string | null;
  days_since: number | null;
  bucket: StockAuditBucket;
};

export type StockAuditOpenBatchSummary = {
  id: string;
  created_at: string;
  created_by: string;
  target_count: number;
  pending_count: number;
  done_count: number;
};

export type StockAuditOverview = {
  branch: StockAuditBranch;
  with_stock_only: boolean;
  as_of: string;
  sales_from: string | null;
  sales_to: string | null;
  summary: StockAuditSummary;
  daily_marks: StockAuditDailyMark[];
  operator_marks: StockAuditOperatorMark[];
  open_batches: StockAuditOpenBatchSummary[];
  rows: StockAuditRow[];
  row_total: number;
  limit: number;
  offset: number;
  bucket: StockAuditBucket | null;
};

export type StockAuditBatchItem = {
  bcode: string;
  status: StockAuditBatchItemStatus;
  priority_score: number;
  pos_dateaudit: string | null;
  app_dateaudit: string | null;
  location1: string | null;
  descr: string | null;
  qty: number;
  sell_qty_period: number;
  sell_revenue_period: number;
  done_at: string | null;
  done_by: string | null;
};

export type StockAuditBatch = {
  id: string;
  branch: StockAuditBranch;
  created_at: string;
  created_by: string;
  target_count: number;
  status: "open" | "closed";
  filters: Record<string, unknown>;
  closed_at: string | null;
  pending_count: number;
  done_count: number;
  skipped_count: number;
  items: StockAuditBatchItem[];
};

export type StockAuditLookup = {
  found: boolean;
  branch: StockAuditBranch;
  bcode: string;
  descr?: string;
  brand?: string;
  model?: string;
  location1?: string;
  qty?: number;
  sell_qty_period?: number;
  sell_revenue_period?: number;
  pos_dateaudit?: string | null;
  app_dateaudit?: string | null;
  app_audited_by?: string | null;
  audit_count?: number | null;
  effective_date?: string | null;
};

export const STOCK_AUDIT_BUCKETS: {
  key: StockAuditBucket;
  label: string;
  hint: string;
  tone: string;
  chip: string;
}[] = [
  {
    key: "never",
    label: "ยังไม่เคยตรวจ",
    hint: "ยังไม่เคยมีบันทึกตรวจในระบบ",
    tone: "border-l-slate-400 bg-slate-50/90",
    chip: "bg-slate-200 text-slate-800",
  },
  {
    key: "over_365",
    label: "นานกว่า 1 ปี",
    hint: "เกิน 365 วัน",
    tone: "border-l-rose-600 bg-rose-50/85",
    chip: "bg-rose-100 text-rose-800",
  },
  {
    key: "d365",
    label: "6–12 เดือน",
    hint: "181–365 วัน",
    tone: "border-l-orange-500 bg-orange-50/80",
    chip: "bg-orange-100 text-orange-900",
  },
  {
    key: "d180",
    label: "3–6 เดือน",
    hint: "91–180 วัน",
    tone: "border-l-amber-400 bg-amber-50/80",
    chip: "bg-amber-100 text-amber-900",
  },
  {
    key: "d90",
    label: "1–3 เดือน",
    hint: "31–90 วัน",
    tone: "border-l-lime-500 bg-lime-50/80",
    chip: "bg-lime-100 text-lime-900",
  },
  {
    key: "d30",
    label: "สด ≤ 30 วัน",
    hint: "ตรวจล่าสุดภายใน 30 วัน",
    tone: "border-l-emerald-500 bg-emerald-50/80",
    chip: "bg-emerald-100 text-emerald-900",
  },
];

export function bucketMeta(bucket: StockAuditBucket) {
  return (
    STOCK_AUDIT_BUCKETS.find((b) => b.key === bucket) ?? STOCK_AUDIT_BUCKETS[0]
  );
}
