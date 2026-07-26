import { describe, expect, it } from "vitest";

import {
  normalizeIncomeBlankCosts,
  normalizeIncomeOverview,
} from "./income-queries";

describe("normalizeIncomeOverview", () => {
  it("parses summary, branch, opex categories, and trends", () => {
    const overview = normalizeIncomeOverview({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 6_500_000,
        cogs: 4_800_000,
        gross_profit: 1_700_000,
        gross_margin_pct: 26.15,
        opex: 500_000,
        net_income: 1_200_000,
        net_margin_pct: 18.46,
        bill_count: 1200,
        line_count: 14000,
        blank_cost_line_count: 67,
      },
      previous_summary: {
        revenue_net: 6_000_000,
        cogs: 4_500_000,
        gross_profit: 1_500_000,
        gross_margin_pct: 25,
        opex: 480_000,
        net_income: 1_020_000,
        net_margin_pct: 17,
      },
      by_branch: [
        {
          key: "HQ",
          revenue_net: 5_000_000,
          cogs: 3_700_000,
          gross_profit: 1_300_000,
          opex: 350_000,
          net_income: 950_000,
          bill_count: 900,
        },
        {
          key: "ONLINE",
          revenue_net: 800_000,
          cogs: 500_000,
          gross_profit: 300_000,
          opex: 100_000,
          net_income: 200_000,
          bill_count: 150,
        },
      ],
      opex_by_category: [
        { key: "cat-1", label: "ออนไลน์", amount: 95_000 },
        { key: "cat-2", label: "สาธารณูปโภค", amount: 80_000 },
      ],
      trend_daily: [
        {
          period: "2026-07-01",
          revenue_net: 200_000,
          cogs: 140_000,
          gross_profit: 60_000,
          opex: 10_000,
          net_income: 50_000,
        },
      ],
      trend_monthly: [
        {
          period: "2026-07",
          revenue_net: 6_500_000,
          cogs: 4_800_000,
          gross_profit: 1_700_000,
          opex: 500_000,
          net_income: 1_200_000,
        },
      ],
    });

    expect(overview.summary.gross_profit).toBe(1_700_000);
    expect(overview.summary.net_income).toBe(1_200_000);
    expect(overview.summary.blank_cost_line_count).toBe(67);
    expect(overview.by_branch).toHaveLength(2);
    expect(overview.by_branch[1]?.key).toBe("ONLINE");
    expect(overview.opex_by_category[0]?.label).toBe("ออนไลน์");
    expect(overview.trend_monthly[0]?.net_income).toBe(1_200_000);
    expect(overview.previous_summary.gross_margin_pct).toBe(25);
  });

  it("treats null margin pct as null", () => {
    const overview = normalizeIncomeOverview({
      summary: {
        revenue_net: 0,
        cogs: 0,
        gross_profit: 0,
        gross_margin_pct: null,
        opex: 0,
        net_income: 0,
        net_margin_pct: null,
      },
      previous_summary: {},
    });
    expect(overview.summary.gross_margin_pct).toBeNull();
    expect(overview.summary.net_margin_pct).toBeNull();
  });
});

describe("normalizeIncomeBlankCosts", () => {
  it("parses blank cost line drilldown", () => {
    const blank = normalizeIncomeBlankCosts({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: "HQ",
      limit: 500,
      total_count: 2,
      returned_count: 2,
      truncated: false,
      lines: [
        {
          bill_date: "2026-07-10",
          store_branch: "HQ",
          reporting_branch: "HQ",
          bill_no: "K6907-001",
          bcode: "0100123",
          detail: "FILTER",
          qty: 2,
          mtp: 1,
          amount_gross: 500,
          cost_status: "UNKNOWN",
        },
      ],
    });

    expect(blank.total_count).toBe(2);
    expect(blank.lines[0]?.bill_no).toBe("K6907-001");
    expect(blank.lines[0]?.bcode).toBe("0100123");
    expect(blank.truncated).toBe(false);
  });
});
