import { describe, expect, it } from "vitest";

import { normalizeCashflowOverview } from "./cashflow-queries";

describe("normalizeCashflowOverview", () => {
  it("parses summary, accounts, categories, and trends", () => {
    const overview = normalizeCashflowOverview({
      from: "2026-07-01",
      to: "2026-07-31",
      account_no: null,
      include_ignored: true,
      limit: 30,
      previous_from: "2026-06-01",
      previous_to: "2026-06-30",
      summary: {
        inflow: 1_000_000,
        outflow: 800_000,
        net: 200_000,
        line_count: 120,
        inflow_count: 50,
        outflow_count: 70,
        internal_in: 100_000,
        internal_out: 100_000,
        net_ex_internal: 200_000,
        unclassified_count: 20,
        opening_balance: 500_000,
        ending_balance: 700_000,
        account_count: 6,
      },
      previous_summary: {
        inflow: 900_000,
        outflow: 850_000,
        net: 50_000,
        line_count: 100,
        net_ex_internal: 40_000,
      },
      by_account: [
        {
          key: "064-8-91723-6",
          label: "KBANK · 064-8-91723-6",
          bank_name: "KBANK",
          inflow: 400_000,
          outflow: 300_000,
          net: 100_000,
          line_count: 40,
          ending_balance: 200_000,
        },
      ],
      by_category: [
        {
          key: "tar_cntar_net",
          label: "รับชำระลูกหนี้",
          inflow: 500_000,
          outflow: 0,
          net: 500_000,
          line_count: 10,
        },
      ],
      by_match_status: [
        { key: "matched", line_count: 80, inflow: 700_000, outflow: 500_000 },
      ],
      trend_daily: [
        {
          period: "2026-07-01",
          inflow: 10_000,
          outflow: 5_000,
          net: 5_000,
          line_count: 3,
        },
      ],
      trend_monthly: [
        {
          period: "2026-07",
          inflow: 1_000_000,
          outflow: 800_000,
          net: 200_000,
          line_count: 120,
        },
      ],
      top_inflows: [
        {
          key: "a",
          label: "รับโอน",
          account_no: "064-8-91723-6",
          txn_date: "2026-07-15",
          category_key: "tar_cntar_net",
          category_label: "รับชำระลูกหนี้",
          amount: 50_000,
          match_status: "matched",
        },
      ],
      top_outflows: [
        {
          key: "b",
          label: "จ่ายเจ้าหนี้",
          account_no: "064-8-91723-6",
          txn_date: "2026-07-16",
          category_key: "pvmas",
          category_label: "จ่ายเจ้าหนี้ (PVMAS)",
          amount: 40_000,
          match_status: "matched",
        },
      ],
      accounts: [
        {
          key: "064-8-91723-6",
          label: "KBANK · 064-8-91723-6",
          bank_name: "KBANK",
        },
      ],
    });

    expect(overview.summary.net).toBe(200_000);
    expect(overview.summary.net_ex_internal).toBe(200_000);
    expect(overview.by_account[0]?.ending_balance).toBe(200_000);
    expect(overview.by_category[0]?.label).toBe("รับชำระลูกหนี้");
    expect(overview.trend_monthly[0]?.inflow).toBe(1_000_000);
    expect(overview.top_outflows[0]?.amount).toBe(40_000);
    expect(overview.accounts).toHaveLength(1);
  });

  it("tolerates missing arrays and coerces numeric strings", () => {
    const overview = normalizeCashflowOverview({
      from: "2026-07-01",
      to: "2026-07-31",
      summary: { inflow: "100", outflow: "40", net: "60" },
      previous_summary: {},
    });
    expect(overview.summary.inflow).toBe(100);
    expect(overview.summary.outflow).toBe(40);
    expect(overview.by_account).toEqual([]);
    expect(overview.top_inflows).toEqual([]);
  });
});
