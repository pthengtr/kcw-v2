import { describe, expect, it } from "vitest";

import { parseStockWorkAsOf } from "./work-types";
import {
  parseStockWorkCounts,
  parseStockWorkKpi,
  stockWorkKpiRpcParams,
} from "./work-queries";

describe("parseStockWorkAsOf", () => {
  it("accepts real YYYY-MM-DD dates", () => {
    expect(parseStockWorkAsOf("2026-09-16")).toBe("2026-09-16");
    expect(parseStockWorkAsOf(" 2026-09-16 ")).toBe("2026-09-16");
  });

  it("rejects missing, malformed, or impossible dates", () => {
    expect(parseStockWorkAsOf(undefined)).toBeUndefined();
    expect(parseStockWorkAsOf("")).toBeUndefined();
    expect(parseStockWorkAsOf("16/09/2026")).toBeUndefined();
    expect(parseStockWorkAsOf("2026-02-31")).toBeUndefined();
  });
});

describe("stockWorkKpiRpcParams", () => {
  it("omits p_as_of when no date is selected", () => {
    expect(stockWorkKpiRpcParams({ branch: "SYP" })).toEqual({
      p_branch: "SYP",
    });
  });

  it("passes a valid as-of date through to the RPC", () => {
    expect(
      stockWorkKpiRpcParams({ branch: "HQ", asOf: "2026-09-16" })
    ).toEqual({
      p_branch: "HQ",
      p_as_of: "2026-09-16",
    });
  });
});

describe("parseStockWorkCounts", () => {
  it("parses counts and derives completed when missing", () => {
    expect(
      parseStockWorkCounts({
        count_correct: 3,
        count_variance: 2,
        count_edit: 1,
        audit_approve: 1,
        audit_reject: 0,
        total_actions: 7,
      })
    ).toEqual({
      count_correct: 3,
      count_variance: 2,
      count_edit: 1,
      audit_approve: 1,
      audit_reject: 0,
      total_actions: 7,
      completed_counts: 5,
    });
  });

  it("prefers explicit completed_counts", () => {
    expect(
      parseStockWorkCounts({
        count_correct: 1,
        count_variance: 1,
        completed_counts: 99,
      }).completed_counts
    ).toBe(99);
  });
});

describe("parseStockWorkKpi", () => {
  it("parses branch operators and daily series", () => {
    const kpi = parseStockWorkKpi({
      branch: "syp",
      as_of: "2026-08-13T10:00:00+07:00",
      today: "2026-08-13",
      summary_today: { count_correct: 1, count_variance: 0, total_actions: 1 },
      summary_week: { count_correct: 4, count_variance: 2, total_actions: 8 },
      daily: [{ date: "2026-08-13", count_correct: 1, completed_counts: 1 }],
      operators: [
        {
          line_user_id: "U1",
          display_name: "Ann",
          today: { count_correct: 1, completed_counts: 1 },
          week: { count_correct: 4, count_variance: 2, completed_counts: 6 },
        },
      ],
    });

    expect(kpi.branch).toBe("SYP");
    expect(kpi.summary_today.completed_counts).toBe(1);
    expect(kpi.summary_week.completed_counts).toBe(6);
    expect(kpi.daily).toHaveLength(1);
    expect(kpi.operators[0]?.display_name).toBe("Ann");
    expect(kpi.operators[0]?.week.completed_counts).toBe(6);
  });

  it("tolerates empty payload", () => {
    const kpi = parseStockWorkKpi(null);
    expect(kpi.branch).toBe("HQ");
    expect(kpi.operators).toEqual([]);
    expect(kpi.daily).toEqual([]);
    expect(kpi.summary_today.total_actions).toBe(0);
  });
});
