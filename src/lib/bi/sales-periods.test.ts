import { describe, expect, it } from "vitest";

import {
  bangkokTodayIso,
  preferDailyBreakdown,
  preferDailyTrend,
  resolvePeriodRange,
} from "./sales-periods";

describe("sales period helpers", () => {
  it("resolves month / ytd in Bangkok calendar", () => {
    // 2026-07-25 03:00 UTC = 10:00 Bangkok
    const now = new Date("2026-07-25T03:00:00.000Z");
    expect(resolvePeriodRange("month", undefined, undefined, now)).toEqual({
      from: "2026-07-01",
      to: "2026-07-25",
    });
    expect(resolvePeriodRange("ytd", undefined, undefined, now)).toEqual({
      from: "2026-01-01",
      to: "2026-07-25",
    });
  });

  it("supports single-day custom selection", () => {
    expect(
      resolvePeriodRange("custom", "2026-07-18", undefined, new Date(), "single")
    ).toEqual({ from: "2026-07-18", to: "2026-07-18" });
  });

  it("swaps inverted custom ranges", () => {
    expect(
      resolvePeriodRange("custom", "2026-07-20", "2026-07-10")
    ).toEqual({ from: "2026-07-10", to: "2026-07-20" });
  });

  it("uses daily breakdown within one month, monthly across months", () => {
    expect(preferDailyBreakdown("2026-07-01", "2026-07-25")).toBe(true);
    expect(preferDailyBreakdown("2026-01-01", "2026-07-25")).toBe(false);
    expect(preferDailyTrend("2026-07-01", "2026-07-25")).toBe(true);
  });

  it("computes Bangkok today across UTC day boundary", () => {
    // 2026-07-24 20:00 UTC = 2026-07-25 03:00 Bangkok
    const lateUtc = new Date("2026-07-24T20:00:00.000Z");
    expect(bangkokTodayIso(lateUtc)).toBe("2026-07-25");
  });
});
