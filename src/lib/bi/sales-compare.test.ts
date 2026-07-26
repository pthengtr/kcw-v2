import { describe, expect, it } from "vitest";

import {
  buildChartRowsForYears,
  buildYearSeriesFromMonthly,
  monthKeyLabel,
  normalizePeriods,
  normalizeYears,
  periodLabelThai,
} from "./sales-compare";

describe("sales compare helpers", () => {
  it("normalizes years to at most 3 sorted unique values", () => {
    expect(normalizeYears([2026, 2024, 2025, 2024], new Date("2026-07-25T03:00:00Z"))).toEqual([
      2024, 2025, 2026,
    ]);
    expect(normalizeYears([2010, 2026], new Date("2026-07-25T03:00:00Z"))).toEqual([
      2026,
    ]);
  });

  it("normalizes month periods", () => {
    expect(normalizePeriods(["2026-07", "bad", "2025-07", "2026-07"])).toEqual([
      "2025-07",
      "2026-07",
    ]);
  });

  it("builds year series and chart rows from monthly trend", () => {
    const series = buildYearSeriesFromMonthly(2026, "2026-01-01", "2026-07-25", [
      { period: "2026-01", revenue_net: 100, bill_count: 10 },
      { period: "2026-07", revenue_net: 250, bill_count: 20 },
    ]);
    expect(series.total_revenue_net).toBe(350);
    expect(series.by_month["01"]?.revenue_net).toBe(100);
    expect(series.by_month["02"]?.revenue_net).toBe(0);

    const rows = buildChartRowsForYears([series]);
    expect(rows[0]).toMatchObject({ month: "01", label: "ม.ค.", y2026: 100 });
    expect(rows[6]).toMatchObject({ month: "07", y2026: 250 });
  });

  it("formats Thai month labels", () => {
    expect(monthKeyLabel("07")).toBe("ก.ค.");
    expect(periodLabelThai("2026-07")).toContain("ก.ค.");
    expect(periodLabelThai("2026-07")).toContain("2569");
  });
});
