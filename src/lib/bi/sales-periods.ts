import type { BiCustomDateMode, BiPeriodPreset } from "./sales-types";

export type DateRange = {
  from: string;
  to: string;
};

const bangkokDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Business calendar date in Asia/Bangkok as YYYY-MM-DD. */
export function bangkokTodayIso(now = new Date()): string {
  return bangkokDateFmt.format(now);
}

export function bangkokCurrentMonthIso(now = new Date()): string {
  return bangkokTodayIso(now).slice(0, 7);
}

/** Inclusive end date for YYYY-MM, capped at Bangkok today for the current month. */
export function monthRange(monthIso: string, now = new Date()): DateRange {
  const match = /^(\d{4})-(\d{2})$/.exec(monthIso.trim());
  const today = bangkokTodayIso(now);
  if (!match) {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const from = `${match[1]}-${match[2]}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
  const to = monthIso === today.slice(0, 7) && monthEnd > today ? today : monthEnd;
  return { from, to };
}

export function resolvePeriodRange(
  preset: BiPeriodPreset,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
  customMode: BiCustomDateMode = "range",
  customMonth?: string
): DateRange {
  const today = bangkokTodayIso(now);

  if (preset === "month") {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }

  if (preset === "ytd") {
    return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }

  if (customMode === "month") {
    return monthRange(customMonth || bangkokCurrentMonthIso(now), now);
  }

  const from = customFrom?.trim() || today;
  if (customMode === "single" || !customTo?.trim()) {
    return { from, to: from };
  }

  const to = customTo.trim();
  if (from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

export function periodLabel(preset: BiPeriodPreset): string {
  switch (preset) {
    case "month":
      return "เดือนนี้";
    case "ytd":
      return "ตั้งแต่ต้นปี";
    case "custom":
      return "กำหนดเอง";
  }
}

export function formatThaiDateRange(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function formatThaiPeriodLabel(
  period: string,
  mode: "daily" | "monthly"
): string {
  if (mode === "monthly") {
    const [y, m] = period.split("-").map(Number);
    if (!y || !m) return period;
    const date = new Date(Date.UTC(y, m - 1, 1));
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "UTC",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  return formatThaiDateRange(period, period);
}

/** Same calendar month → daily breakdown; otherwise monthly. */
export function preferDailyBreakdown(from: string, to: string): boolean {
  return from.slice(0, 7) === to.slice(0, 7);
}

export function preferDailyTrend(from: string, to: string): boolean {
  return preferDailyBreakdown(from, to);
}
