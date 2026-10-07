import { normalizeMatchStatus, splitRefIds, isDocumentBillToken } from "@/lib/bank/statement-report-format";

const TR_REF_TYPES = new Set(["tr_bill", "tr_bundle", "tr_remainder", "3tr_bill"]);
const PURCHASE_REF_TYPES = new Set(["pimas", "pimas_possible_bundle"]);

export type StatementDocRow = {
  match_status?: string | null;
  matched_ref_type?: string | null;
  matched_ref_id?: string | null;
};

export type LinkedSalesBill = {
  billno: string;
  docType: "TR" | "3TR";
};

function refType(row: StatementDocRow): string {
  return (row.matched_ref_type ?? "").trim().toLowerCase();
}

function linkable(row: StatementDocRow): boolean {
  const status = normalizeMatchStatus(row.match_status);
  return status !== "pending" && status !== "unmatched" && status !== "ignored";
}

function documentIds(row: StatementDocRow): string[] {
  return splitRefIds(row.matched_ref_id).filter(isDocumentBillToken);
}

/** TR / 3TR bills already stored on the statement row. */
export function statementSalesBills(row: StatementDocRow): LinkedSalesBill[] | null {
  if (!linkable(row) || !TR_REF_TYPES.has(refType(row))) return null;
  const bills = documentIds(row)
    .filter((id) => /^(3)?TR/i.test(id))
    .map((billno) => ({
      billno,
      docType: billno.toUpperCase().startsWith("3TR") ? ("3TR" as const) : ("TR" as const),
    }));
  return bills.length > 0 ? bills : null;
}

/** Receipt or payment voucher number. `rvi` rows have no number, so they stay closed. */
export function statementVoucherNo(row: StatementDocRow): string | null {
  if (!linkable(row)) return null;
  const type = refType(row);
  if (type !== "rvmas" && type !== "pvmas") return null;
  return documentIds(row)[0] ?? null;
}

/** Purchase bill numbers matched directly, not through a voucher. */
export function statementPurchaseBills(row: StatementDocRow): string[] | null {
  if (!linkable(row) || !PURCHASE_REF_TYPES.has(refType(row))) return null;
  const bills = documentIds(row);
  return bills.length > 0 ? bills : null;
}
