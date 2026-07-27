import { describe, expect, it } from "vitest";

import { normalizeCustomerOverview } from "./customer-queries";

describe("normalizeCustomerOverview", () => {
  it("parses ranking rows, walk-in summary, and unmatched list", () => {
    const overview = normalizeCustomerOverview({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      limit: 50,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 3_200_000,
        customer_count: 280,
        bill_count: 2100,
        avg_bill: 1523,
        matched_customer_count: 195,
        unmatched_customer_count: 85,
      },
      walkin_summary: {
        revenue_net: 3_300_000,
        bill_count: 3400,
      },
      previous_summary: {
        revenue_net: 3_000_000,
        customer_count: 260,
        bill_count: 2000,
      },
      by_branch: [{ key: "HQ", revenue_net: 2_000_000, bill_count: 1200 }],
      top_customers: [
        {
          acctno: "7ICE",
          customer_name: "ICE TIKTOK SHOP",
          name_source: "party",
          bill_acctname: "ICE",
          in_party: true,
          in_armas: true,
          party_kind: "CUSTOMER",
          revenue_net: 120_000,
          bill_count: 40,
          avg_bill: 3000,
          hq_revenue_net: 0,
          syp_revenue_net: 0,
          online_revenue_net: 120_000,
        },
      ],
      unmatched_customers: [
        {
          acctno: "XYZ99",
          customer_name: "ร้านจาก ARMAS",
          name_source: "armas",
          bill_acctname: "ร้านทดสอบ",
          in_party: false,
          in_armas: true,
          party_kind: null,
          revenue_net: 12_000,
          bill_count: 3,
          avg_bill: 4000,
          hq_revenue_net: 12_000,
          syp_revenue_net: 0,
          online_revenue_net: 0,
        },
      ],
    });

    expect(overview.summary.customer_count).toBe(280);
    expect(overview.walkin_summary.bill_count).toBe(3400);
    expect(overview.top_customers[0]).toMatchObject({
      acctno: "7ICE",
      in_party: true,
      name_source: "party",
      online_revenue_net: 120_000,
    });
    expect(overview.unmatched_customers[0]).toMatchObject({
      acctno: "XYZ99",
      in_party: false,
      in_armas: true,
      name_source: "armas",
      customer_name: "ร้านจาก ARMAS",
    });
  });

  it("keeps blank customer_name when neither party nor ARMAS has a name", () => {
    const overview = normalizeCustomerOverview({
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      limit: 50,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 1000,
        customer_count: 1,
        bill_count: 1,
        avg_bill: 1000,
        matched_customer_count: 0,
        unmatched_customer_count: 1,
      },
      walkin_summary: { revenue_net: 0, bill_count: 0 },
      previous_summary: {
        revenue_net: 0,
        customer_count: 0,
        bill_count: 0,
      },
      by_branch: [],
      top_customers: [
        {
          acctno: "NOMASTER",
          customer_name: null,
          name_source: "none",
          bill_acctname: "ชื่อบนบิล",
          in_party: false,
          in_armas: false,
          party_kind: null,
          revenue_net: 1000,
          bill_count: 1,
          avg_bill: 1000,
          hq_revenue_net: 1000,
          syp_revenue_net: 0,
          online_revenue_net: 0,
        },
      ],
      unmatched_customers: [],
    });

    expect(overview.top_customers[0]).toMatchObject({
      acctno: "NOMASTER",
      customer_name: "",
      name_source: "none",
      in_armas: false,
    });
  });
});
