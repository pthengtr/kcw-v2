export function formatPoTs(value: string | null | undefined) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("th-TH");
}

export function formatPoAmount(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPoQty(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("th-TH", {
    maximumFractionDigits: 3,
  });
}

export function formatProductDescr(
  descr: string | null | undefined,
  mcode: string | null | undefined
) {
  const d = descr?.trim() || "";
  const m = mcode?.trim() || "";
  if (d && m) return `${d} · ${m}`;
  return d || m || "—";
}

export function formatPoDate(value: string | null | undefined) {
  if (!value) return "—";
  // DOCDATE often comes as YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("th-TH");
}

export function billedLabel(billed: string | null | undefined) {
  if (billed === "Y") return "รับแล้ว";
  if (billed === "N") return "เปิด";
  return billed ?? "—";
}

export type PoPrepareStatus = "not_prepared" | "partially_prepared" | "prepared";

export function prepareStatusLabel(status: PoPrepareStatus | string | null | undefined) {
  switch (status) {
    case "prepared":
      return "เตรียมแล้ว";
    case "partially_prepared":
      return "จัดของบางส่วน";
    case "not_prepared":
      return "ยังไม่เตรียม";
    default:
      return "ยังไม่เตรียม";
  }
}

/** High-contrast badge colors for prepare status on /po SYP tab. */
export function prepareStatusBadgeClassName(
  status: PoPrepareStatus | string | null | undefined
): string {
  switch (status) {
    case "prepared":
      return "border-emerald-600 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100";
    case "partially_prepared":
      return "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
  }
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type PoLookbackPreset =
  | { kind: "days"; days: number }
  | { kind: "months"; months: number };

/** Looking-back DOCDATE window ending today (local). */
export function poDateRangeLookingBack(
  preset: PoLookbackPreset,
  now = new Date()
): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  if (preset.kind === "days") {
    from.setDate(from.getDate() - preset.days);
  } else {
    from.setMonth(from.getMonth() - preset.months);
  }
  return { from: isoDateLocal(from), to: isoDateLocal(to) };
}

/** Default ICLOW list window — keep queries under statement_timeout. */
export function last30DaysPoDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  return poDateRangeLookingBack({ kind: "days", days: 30 }, now);
}

export const PO_DATE_LOOKBACK_PRESETS: Array<{
  id: string;
  label: string;
  preset: PoLookbackPreset;
}> = [
  { id: "30d", label: "30 วัน", preset: { kind: "days", days: 30 } },
  { id: "60d", label: "60 วัน", preset: { kind: "days", days: 60 } },
  { id: "3m", label: "3 เดือน", preset: { kind: "months", months: 3 } },
  { id: "6m", label: "6 เดือน", preset: { kind: "months", months: 6 } },
  { id: "1y", label: "1 ปี", preset: { kind: "months", months: 12 } },
];
