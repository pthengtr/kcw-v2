import { describe, expect, it } from "vitest";

import {
  formatBaht,
  formatBahtCompact,
  formatPct,
  pctChange,
  shareOf,
} from "./sales-format";

describe("sales format helpers", () => {
  it("formats baht with sign", () => {
    expect(formatBaht(1234)).toContain("1,234");
    expect(formatBaht(-50)).toMatch(/^-฿/);
  });

  it("formats large baht in compact form", () => {
    expect(formatBahtCompact(1234)).toBe(formatBaht(1234));
    expect(formatBahtCompact(1_200_000)).toMatch(/^฿/);
    expect(formatBahtCompact(1_200_000).length).toBeLessThan(
      formatBaht(1_200_000).length
    );
    expect(formatBahtCompact(-50_000)).toMatch(/^-฿/);
  });

  it("computes percent change and share", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(50, 0)).toBeNull();
    expect(shareOf(25, 100)).toBe(25);
    expect(formatPct(12.34)).toBe("+12.3%");
    expect(formatPct(-3)).toBe("-3.0%");
  });
});
