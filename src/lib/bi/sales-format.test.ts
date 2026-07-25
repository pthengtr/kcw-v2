import { describe, expect, it } from "vitest";

import { formatBaht, formatPct, pctChange, shareOf } from "./sales-format";

describe("sales format helpers", () => {
  it("formats baht with sign", () => {
    expect(formatBaht(1234)).toContain("1,234");
    expect(formatBaht(-50)).toMatch(/^-฿/);
  });

  it("computes percent change and share", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(50, 0)).toBeNull();
    expect(shareOf(25, 100)).toBe(25);
    expect(formatPct(12.34)).toBe("+12.3%");
    expect(formatPct(-3)).toBe("-3.0%");
  });
});
