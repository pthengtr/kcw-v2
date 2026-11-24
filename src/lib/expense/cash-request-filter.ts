import type {
  ExpenseCashAccountingStatus,
  ExpenseCashBranch,
  ExpenseCashRequest,
  ExpenseCashStatus,
} from "@/lib/expense/cash-request";

export type ExpenseCashFilters = {
  query: string;
  paidFrom: string;
  paidTo: string;
  branch: "all" | ExpenseCashBranch;
  status: "all" | ExpenseCashStatus;
  accountingStatus: "all" | ExpenseCashAccountingStatus;
};

export const EMPTY_EXPENSE_CASH_FILTERS: ExpenseCashFilters = {
  query: "",
  paidFrom: "",
  paidTo: "",
  branch: "all",
  status: "all",
  accountingStatus: "all",
};

/** Asia/Bangkok calendar date YYYY-MM-DD for an ISO timestamp. */
export function bangkokDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return null;
  return `${y}-${m}-${d}`;
}

export function formatExpenseCashDate(
  iso: string | null | undefined
): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatExpenseCashDateTime(
  iso: string | null | undefined
): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function filterExpenseCashRequests(
  rows: ExpenseCashRequest[],
  filters: ExpenseCashFilters
): ExpenseCashRequest[] {
  const q = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.branch !== "all" && row.branch !== filters.branch) {
      return false;
    }
    if (filters.status !== "all" && row.status !== filters.status) {
      return false;
    }
    if (
      filters.accountingStatus !== "all" &&
      row.accounting_status !== filters.accountingStatus
    ) {
      return false;
    }
    if (filters.paidFrom || filters.paidTo) {
      const paidKey = bangkokDateKey(row.paid_at);
      if (!paidKey) return false;
      if (filters.paidFrom && paidKey < filters.paidFrom) return false;
      if (filters.paidTo && paidKey > filters.paidTo) return false;
    }
    if (q) {
      const hay = [
        String(row.short_code),
        row.requester_name ?? "",
        row.requester_line_user_id,
        row.reason,
        row.extra_reason ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function summarizeExpenseCashRequests(rows: ExpenseCashRequest[]): {
  count: number;
  totalAmount: number;
  /** Paid rows still waiting to be booked — excludes recorded + skipped. */
  pendingAccountingCount: number;
  pendingAccountingAmount: number;
} {
  let totalAmount = 0;
  let pendingAccountingCount = 0;
  let pendingAccountingAmount = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    totalAmount += amount;
    if (row.status === "paid" && row.accounting_status === "pending") {
      pendingAccountingCount += 1;
      pendingAccountingAmount += amount;
    }
  }
  return {
    count: rows.length,
    totalAmount,
    pendingAccountingCount,
    pendingAccountingAmount,
  };
}

export function canUpdateExpenseCashAccounting(
  row: ExpenseCashRequest
): boolean {
  return row.status === "paid";
}
