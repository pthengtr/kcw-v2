import { describe, expect, it } from "vitest";

import {
  customerRankAmount,
  customerRankTotal,
  filterAndRankCustomers,
} from "./customer-rank-filter";
import type { BiCustomerRankRow } from "./customer-types";

const rows: BiCustomerRankRow[] = [
  {
    acctno: "A",
    customer_name: "Alpha",
    name_source: "party",
    bill_acctname: null,
    in_party: true,
    in_armas: true,
    party_kind: "CUSTOMER",
    revenue_net: 100,
    bill_count: 3,
    avg_bill: 33,
    hq_revenue_net: 10,
    syp_revenue_net: 20,
    online_revenue_net: 70,
  },
  {
    acctno: "B",
    customer_name: "Beta",
    name_source: "party",
    bill_acctname: null,
    in_party: true,
    in_armas: true,
    party_kind: "CUSTOMER",
    revenue_net: 90,
    bill_count: 2,
    avg_bill: 45,
    hq_revenue_net: 80,
    syp_revenue_net: 10,
    online_revenue_net: 0,
  },
  {
    acctno: "C",
    customer_name: "Gamma Shop",
    name_source: "armas",
    bill_acctname: null,
    in_party: false,
    in_armas: true,
    party_kind: null,
    revenue_net: 50,
    bill_count: 1,
    avg_bill: 50,
    hq_revenue_net: 0,
    syp_revenue_net: 50,
    online_revenue_net: 0,
  },
];

describe("customer rank branch filter", () => {
  it("ranks by online revenue and drops zero online", () => {
    const ranked = filterAndRankCustomers(rows, "ONLINE");
    expect(ranked.map((r) => r.acctno)).toEqual(["A"]);
    expect(customerRankAmount(ranked[0]!, "ONLINE")).toBe(70);
  });

  it("ranks by HQ and keeps search", () => {
    const ranked = filterAndRankCustomers(rows, "HQ", "bet");
    expect(ranked.map((r) => r.acctno)).toEqual(["B"]);
  });

  it("sums filtered channel totals", () => {
    expect(customerRankTotal(rows, "SYP")).toBe(80);
    expect(customerRankTotal(filterAndRankCustomers(rows, "SYP"), "SYP")).toBe(
      80
    );
  });
});
