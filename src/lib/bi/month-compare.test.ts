import { describe, expect, it } from "vitest";

import {
  parseMonthColumns,
  parseMonthCompareRows,
} from "./month-compare";

describe("month compare parsers", () => {
  it("parses month columns and row months map", () => {
    const rows = parseMonthCompareRows([
      {
        key: "C001",
        label: "ลูกค้า A",
        sublabel: "C001",
        total: 150_000,
        months: { "2026-01": 50_000, "2026-02": 100_000 },
      },
    ]);

    expect(parseMonthColumns(["2026-01", "2026-02"])).toEqual([
      "2026-01",
      "2026-02",
    ]);
    expect(rows[0]?.months["2026-02"]).toBe(100_000);
    expect(rows[0]?.sublabel).toBe("C001");
  });
});
