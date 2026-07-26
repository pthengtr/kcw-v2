import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchSalesOverview } from "./sales-queries";
import { monthRange, ytdRangeForYear } from "./sales-periods";
import type {
  BiSalesCompareMode,
  BiSalesCompareMonthPoint,
  BiSalesComparePeriodPoint,
  BiSalesCompareResult,
  BiSalesCompareYearSeries,
} from "./sales-compare-types";

export const MONTH_KEYS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const;

const TH_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function monthKeyLabel(mm: string): string {
  const idx = Number(mm) - 1;
  return TH_MONTH_SHORT[idx] ?? mm;
}

export function periodLabelThai(period: string): string {
  const [y, m] = period.split("-");
  if (!y || !m) return period;
  return `${monthKeyLabel(m)} ${Number(y) + 543}`;
}

export function normalizeYears(years: number[], now = new Date()): number[] {
  const current = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(now)
  );
  const cleaned = [...new Set(years)]
    .filter((y) => Number.isFinite(y) && y >= 2020 && y <= current + 1)
    .map((y) => Math.trunc(y))
    .sort((a, b) => a - b);
  return cleaned.slice(-3);
}

export function normalizePeriods(periods: string[]): string[] {
  const cleaned = [...new Set(periods)]
    .filter((p) => /^\d{4}-\d{2}$/.test(p))
    .sort();
  return cleaned.slice(-6);
}

export function emptyMonthMap(): Record<string, BiSalesCompareMonthPoint> {
  return Object.fromEntries(
    MONTH_KEYS.map((mm) => [mm, { revenue_net: 0, bill_count: 0 }])
  );
}

export function buildYearSeriesFromMonthly(
  year: number,
  from: string,
  to: string,
  trendMonthly: {
    period: string;
    revenue_net: number;
    bill_count: number;
  }[]
): BiSalesCompareYearSeries {
  const by_month = emptyMonthMap();
  let total_revenue_net = 0;
  let total_bill_count = 0;

  for (const row of trendMonthly) {
    const mm = row.period.slice(5, 7);
    if (!by_month[mm]) continue;
    by_month[mm] = {
      revenue_net: row.revenue_net,
      bill_count: row.bill_count,
    };
    total_revenue_net += row.revenue_net;
    total_bill_count += row.bill_count;
  }

  return {
    year,
    from,
    to,
    total_revenue_net,
    total_bill_count,
    by_month,
  };
}

export function buildChartRowsForYears(series: BiSalesCompareYearSeries[]) {
  return MONTH_KEYS.map((mm) => {
    const row: Record<string, string | number> = {
      month: mm,
      label: monthKeyLabel(mm),
    };
    for (const s of series) {
      row[`y${s.year}`] = s.by_month[mm]?.revenue_net ?? 0;
      row[`b${s.year}`] = s.by_month[mm]?.bill_count ?? 0;
    }
    return row;
  });
}

export async function fetchSalesCompare(
  supabase: SupabaseClient,
  params: {
    mode: BiSalesCompareMode;
    years?: number[];
    periods?: string[];
    branch?: string | null;
    now?: Date;
  }
): Promise<BiSalesCompareResult> {
  const now = params.now ?? new Date();
  const branch = params.branch ?? null;
  const mode = params.mode;

  if (mode === "months") {
    const periods = normalizePeriods(params.periods ?? []);
    if (periods.length === 0) {
      return {
        mode,
        branch,
        years: [],
        periods: [],
        month_keys: [...MONTH_KEYS],
        series: [],
        period_points: [],
      };
    }

    const points: BiSalesComparePeriodPoint[] = [];
    for (const period of periods) {
      const range = monthRange(period, now);
      const overview = await fetchSalesOverview(supabase, {
        from: range.from,
        to: range.to,
        branch,
      });
      points.push({
        period,
        label: periodLabelThai(period),
        revenue_net: overview.summary.revenue_net,
        bill_count: overview.summary.bill_count,
      });
    }

    return {
      mode,
      branch,
      years: [...new Set(periods.map((p) => Number(p.slice(0, 4))))].sort(
        (a, b) => a - b
      ),
      periods,
      month_keys: [...MONTH_KEYS],
      series: [],
      period_points: points,
    };
  }

  const years = normalizeYears(params.years ?? [], now);
  const series: BiSalesCompareYearSeries[] = [];

  for (const year of years) {
    const range = ytdRangeForYear(year, now);
    const overview = await fetchSalesOverview(supabase, {
      from: range.from,
      to: range.to,
      branch,
    });
    series.push(
      buildYearSeriesFromMonthly(
        year,
        range.from,
        range.to,
        overview.trend_monthly
      )
    );
  }

  return {
    mode: "years",
    branch,
    years,
    periods: [],
    month_keys: [...MONTH_KEYS],
    series,
    period_points: [],
  };
}
