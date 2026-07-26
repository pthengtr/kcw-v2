import type { BiSplitRow } from "./sales-types";

export type BiCustomerSummary = {
  revenue_net: number;
  customer_count: number;
  bill_count: number;
  avg_bill: number;
  matched_customer_count: number;
  unmatched_customer_count: number;
};

export type BiCustomerWalkinSummary = {
  revenue_net: number;
  bill_count: number;
};

export type BiCustomerPreviousSummary = {
  revenue_net: number;
  customer_count: number;
  bill_count: number;
};

export type BiCustomerRankRow = {
  acctno: string;
  customer_name: string;
  bill_acctname: string | null;
  in_party: boolean;
  party_kind: string | null;
  revenue_net: number;
  bill_count: number;
  avg_bill: number;
  hq_revenue_net: number;
  syp_revenue_net: number;
  online_revenue_net: number;
};

export type BiCustomerOverview = {
  from: string;
  to: string;
  branch: string | null;
  limit: number;
  previous_from: string;
  previous_to: string;
  summary: BiCustomerSummary;
  walkin_summary: BiCustomerWalkinSummary;
  previous_summary: BiCustomerPreviousSummary;
  by_branch: BiSplitRow[];
  top_customers: BiCustomerRankRow[];
  unmatched_customers: BiCustomerRankRow[];
};
