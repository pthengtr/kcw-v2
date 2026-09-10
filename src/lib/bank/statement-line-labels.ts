import {
  resolveDescriptionColumn,
  type StatementLineRow as ReportStatementLineRow,
} from "@/lib/bank/statement-report-format";
import { attachMatchedPartyAndBills } from "@/lib/bank/statement-report-party-lookup";

export type LineForLabel = {
  account_no?: string | null;
  bank_name?: string | null;
  txn_date?: string | null;
  value_date?: string | null;
  description?: string | null;
  bank_reference?: string | null;
  amount?: number | null;
  direction?: string | null;
  debit?: number | null;
  credit?: number | null;
  balance_after?: number | null;
  raw_json?: unknown;
  source_row_number?: number | null;
  source_file_id?: string | null;
  match_status?: string | null;
  match_reason?: string | null;
  match_notes?: string | null;
  report_remark?: string | null;
  matched_ref_type?: string | null;
  matched_ref_id?: string | null;
  match_confidence?: number | null;
};

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toReportStatementLine(
  row: LineForLabel,
): ReportStatementLineRow {
  const direction = String(row.direction ?? "").trim().toLowerCase();
  const amount = toNum(row.amount);
  const debit =
    toNum(row.debit) ??
    (direction === "out" && amount != null ? amount : null);
  const credit =
    toNum(row.credit) ??
    (direction === "in" && amount != null ? amount : null);

  return {
    account_no: row.account_no ?? null,
    bank_name: row.bank_name ?? null,
    txn_date: row.txn_date ?? null,
    value_date: row.value_date ?? null,
    description: row.description ?? null,
    bank_reference: row.bank_reference ?? null,
    amount,
    direction: row.direction ?? null,
    debit,
    credit,
    balance_after: toNum(row.balance_after),
    raw_json: row.raw_json ?? {},
    source_row_number: row.source_row_number ?? null,
    source_file_id: row.source_file_id ?? null,
    match_status: row.match_status ?? null,
    match_reason: row.match_reason ?? null,
    match_notes: row.match_notes ?? null,
    report_remark: row.report_remark ?? null,
    matched_ref_type: row.matched_ref_type ?? null,
    matched_ref_id: row.matched_ref_id ?? null,
    match_confidence: toNum(row.match_confidence),
    original_filename: null,
  };
}

/**
 * Same รายการ / ชื่อบริษัท text the monthly Excel uses.
 * Looks up party/bill names when an admin client is provided.
 */
export async function decorateStatementLineLabels<T extends LineForLabel>(
  rows: T[],
  admin?: Parameters<typeof attachMatchedPartyAndBills>[0],
): Promise<(T & { item_label: string })[]> {
  if (rows.length === 0) return [];

  let reportRows = rows.map(toReportStatementLine);
  if (admin) {
    reportRows = await attachMatchedPartyAndBills(admin, reportRows);
  }

  return rows.map((row, i) => ({
    ...row,
    item_label: resolveDescriptionColumn(reportRows[i]),
  }));
}

export function statementItemLabel(row: LineForLabel): string {
  return resolveDescriptionColumn(toReportStatementLine(row));
}
