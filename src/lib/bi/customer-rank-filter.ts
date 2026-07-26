import type { BiCustomerRankRow } from "./customer-types";
import type { BiBranchFilter } from "./sales-types";

export const CUSTOMER_RANK_BRANCH_FILTERS: {
  key: BiBranchFilter;
  label: string;
}[] = [
  { key: "ALL", label: "ทั้งหมด" },
  { key: "HQ", label: "HQ" },
  { key: "SYP", label: "SYP" },
  { key: "ONLINE", label: "ออนไลน์" },
];

export function customerRankAmount(
  row: BiCustomerRankRow,
  branch: BiBranchFilter
): number {
  switch (branch) {
    case "HQ":
      return row.hq_revenue_net;
    case "SYP":
      return row.syp_revenue_net;
    case "ONLINE":
      return row.online_revenue_net;
    case "ALL":
    default:
      return row.revenue_net;
  }
}

/** Client-side re-rank helper when full channel splits are already loaded. */
export function filterAndRankCustomers(
  rows: BiCustomerRankRow[],
  branch: BiBranchFilter,
  query = ""
): BiCustomerRankRow[] {
  const q = query.trim().toLowerCase();
  const searched = q
    ? rows.filter((row) => {
        const hay = [
          row.acctno,
          row.customer_name,
          row.bill_acctname ?? "",
          row.party_kind ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : rows;

  const filtered =
    branch === "ALL"
      ? searched
      : searched.filter((row) => customerRankAmount(row, branch) !== 0);

  return [...filtered].sort((a, b) => {
    const diff = customerRankAmount(b, branch) - customerRankAmount(a, branch);
    if (diff !== 0) return diff;
    return a.acctno.localeCompare(b.acctno, "th");
  });
}

export function customerRankTotal(
  rows: BiCustomerRankRow[],
  branch: BiBranchFilter
): number {
  return rows.reduce((sum, row) => sum + customerRankAmount(row, branch), 0);
}
