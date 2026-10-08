import { normalizeMatchStatus, splitRefIds, isDocumentBillToken } from "@/lib/bank/statement-report-format";

const TR_REF_TYPES = new Set(["tr_bill", "tr_bundle", "tr_remainder", "3tr_bill"]);
const PURCHASE_REF_TYPES = new Set(["pimas", "pimas_possible_bundle"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Counterpart nicknames such as X2446, stored when no voucher was found. */
const ACCOUNT_ALIAS_RE = /^X\d+$/i;

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

/** Expense receipt UUIDs or voucher numbers. Account aliases stay closed. */
export function statementExpenseReceipts(row: StatementDocRow): string[] | null {
  if (!linkable(row) || refType(row) !== "expense_pv") return null;
  const ids = splitRefIds(row.matched_ref_id).filter((id) => {
    if (UUID_RE.test(id)) return true;
    if (ACCOUNT_ALIAS_RE.test(id)) return false;
    return isDocumentBillToken(id);
  });
  return ids.length > 0 ? ids : null;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Same net as the expense voucher screen: lines, then VAT, then withholding. */
export function expenseReceiptTotals(input: {
  lineAmounts: number[];
  discount: number;
  taxExempt: number;
  vatRate: number;
  withholdingRate: number;
}): {
  beforeTax: number;
  discount: number;
  vatAmount: number;
  withholdingAmount: number;
  net: number;
} {
  const beforeTax = input.lineAmounts.reduce((sum, amount) => sum + amount, 0);
  const discount = input.discount;
  const taxable = beforeTax - discount - input.taxExempt;
  const vatAmount = taxable * (input.vatRate / 100);
  const withholdingAmount = taxable * (input.withholdingRate / 100);
  return {
    beforeTax: roundMoney(beforeTax),
    discount: roundMoney(discount),
    vatAmount: roundMoney(vatAmount),
    withholdingAmount: roundMoney(withholdingAmount),
    net: roundMoney(beforeTax - discount + vatAmount - withholdingAmount),
  };
}

export type VoucherListBill = {
  source: string;
  amount: number;
  canceled: boolean;
};

/** Bill count excludes the voucher discount row. Total includes it. */
export function voucherListSummary(bills: VoucherListBill[]): {
  billCount: number;
  total: number;
  discount: number;
} {
  const documents = bills.filter((bill) => bill.source !== "discount");
  const discount = bills
    .filter((bill) => bill.source === "discount" && !bill.canceled)
    .reduce((sum, bill) => sum + bill.amount, 0);
  const total = bills.reduce((sum, bill) => sum + (bill.canceled ? 0 : bill.amount), 0);
  return {
    billCount: documents.length,
    total: Math.round(total * 100) / 100,
    discount: Math.round(discount * 100) / 100,
  };
}
