export type BiSalesCompareMode = "years" | "months";

export type BiSalesCompareViz = "table" | "bar" | "line";

export type BiSalesCompareMonthPoint = {
  revenue_net: number;
  bill_count: number;
};

export type BiSalesCompareYearSeries = {
  year: number;
  from: string;
  to: string;
  total_revenue_net: number;
  total_bill_count: number;
  /** Keys are MM ("01"…"12") for seasonal alignment */
  by_month: Record<string, BiSalesCompareMonthPoint>;
};

export type BiSalesComparePeriodPoint = {
  period: string;
  label: string;
  revenue_net: number;
  bill_count: number;
};

export type BiSalesCompareResult = {
  mode: BiSalesCompareMode;
  branch: string | null;
  years: number[];
  periods: string[];
  month_keys: string[];
  series: BiSalesCompareYearSeries[];
  period_points: BiSalesComparePeriodPoint[];
};
