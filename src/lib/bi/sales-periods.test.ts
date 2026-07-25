import { describe, expect, it } from "vitest";

import {
  bangkokTodayIso,
  preferDailyTrend,
  resolvePeriodRange,
} from "./sales-periods";

describe("sales period helpers", () => {
  it("resolves today / month / ytd in Bangkok calendar", () => {
    // 2026-07-25 03:00 UTC = 10:00 Bangkok
    const now = new Date("2026-07-25T03:00:00.000Z");
    expect(resolvePeriodRange("today", undefined, undefined, now)).toEqual({
      from: "2026-07-25",
      to: "2026-07-25",
    });
    expect(resolvePeriodRange("month", undefined, undefined, now)).toEqual({
      from: "2026-07-01",
      to: "2026-07-25",
    });
    expect(resolvePeriodRange("ytd", undefined, undefined, now)).toEqual({
      from: "2026-01-01",
      to: "2026-07-25",
    });
  });

  it("swaps inverted custom ranges", () => {
    expect(
      resolvePeriodRange("custom", "2026-07-20", "2026-07-10")
    ).toEqual({ from: "2026-07-10", to: "2026-07-20" });
  });

  it("prefers daily trend for short ranges", () => {
    expect(preferDailyTrend("2026-07-01", "2026-07-25")).toBe(true);
    expect(preferDailyTrend("2026-01-01", "2026-07-25")).toBe(false);
  });

  it("computes Bangkok today across UTC day boundary", () => {
    // 2026-07-24 20:00 UTC = 2026-07-25 03:00 Bangkok
    const lateUtc = new Date("2026-07-24T20:00:00.000Z");
    expect(bangkokTodayIso(lateUtc)).toBe("2026-07-25");
  });
});
