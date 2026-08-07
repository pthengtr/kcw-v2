import { describe, expect, it } from "vitest";

import {
  normalizeCashflowDashboard,
  normalizeCashflowDrilldown,
} from "./cashflow-dashboard-queries";

describe("normalizeCashflowDashboard", () => {
  it("parses summary, statement, charts, and reconciliation", () => {
    const dash = normalizeCashflowDashboard({
      year: 2026,
      through_month: 7,
      as_of: "2026-07-31",
      previous_year: 2025,
      summary: {
        ending_cash: 2_000_000,
        opening_cash: 500_000,
        sales_cash_in: 5_000_000,
        operating_cash_flow: 1_200_000,
        investing_cash_flow: 0,
        financing_cash_flow: -100_000,
        net_cash_change: 1_100_000,
        cash_in: 5_000_000,
        cash_out: 3_900_000,
        unclassified_line_count: 10,
        unclassified_inflow: 100,
        unclassified_outflow: 200,
      },
      previous_summary: {
        sales_cash_in: 4_000_000,
        operating_cash_flow: 900_000,
        financing_cash_flow: 0,
        net_cash_change: 900_000,
      },
      monthly_movement: [
        {
          month: 1,
          period: "2026-01",
          has_data: false,
          cash_in: null,
          cash_out: null,
          net_change: null,
        },
        {
          month: 7,
          period: "2026-07",
          has_data: true,
          cash_in: "1000000",
          cash_out: 800_000,
          net_change: 200_000,
        },
      ],
      balance_trend: [
        {
          month: 7,
          period: "2026-07",
          has_data: true,
          opening_cash: 1_800_000,
          ending_cash: 2_000_000,
        },
      ],
      statement_rows: [
        {
          key: "op_header",
          kind: "section",
          label: "Operating Activities",
          label_th: "กิจกรรมดำเนินงาน",
        },
        {
          key: "1001",
          kind: "line",
          code: "1001",
          label: "Cash received from sales",
          label_th: "เงินสดรับ",
          sign: 1,
          months: { "7": 1_000_000 },
          ytd: 5_000_000,
        },
      ],
      operating_breakdown: [
        {
          key: "1002",
          label: "Inventory / purchases",
          label_th: "ซื้อสินค้า",
          amount: 2_000_000,
          share_of_sales: 0.4,
        },
      ],
      bank_reconciliation: {
        total_actual_balance: 2_000_000,
        total_calculated_balance: 1_999_000,
        difference: 1_000,
        accounts: [
          {
            key: "064-8-91723-6",
            account_code: "7236",
            account_name: "KBANK 7236",
            opening_balance: 100_000,
            cash_in: 500_000,
            cash_out: 200_000,
            calculated_closing: 400_000,
            actual_balance: 400_000,
            variance: 0,
          },
        ],
      },
      available_years: [2026],
    });

    expect(dash.summary.operating_cash_flow).toBe(1_200_000);
    expect(dash.monthly_movement[0]?.has_data).toBe(false);
    expect(dash.monthly_movement[1]?.cash_in).toBe(1_000_000);
    expect(dash.statement_rows[1]?.ytd).toBe(5_000_000);
    expect(dash.operating_breakdown[0]?.share_of_sales).toBe(0.4);
    expect(dash.bank_reconciliation.difference).toBe(1_000);
  });
});

describe("normalizeCashflowDrilldown", () => {
  it("parses drilldown lines", () => {
    const d = normalizeCashflowDrilldown({
      year: 2026,
      month: 7,
      code: "1001",
      from: "2026-07-01",
      to: "2026-07-31",
      lines: [
        {
          id: "x",
          transaction_date: "2026-07-15",
          description: "รับโอน",
          account_no: "064-8-91723-6",
          bank_name: "KBANK",
          amount: "50000",
          direction: "in",
          cashflow_code: "1001",
          matched_ref_type: "tar_cntar_net",
          reference: "REF",
          match_status: "matched",
        },
      ],
    });
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]?.amount).toBe(50_000);
  });
});
