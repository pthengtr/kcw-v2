import { createHash } from "crypto";

import { bangkokTodayIso } from "@/lib/bi/sales-periods";

export const VAT_SHEET_ORDER = [
  "TAR",
  "CNTAR",
  "TD",
  "TR",
  "TAD",
  "TO",
  "CN",
  "CNTAD",
  "3TAR",
  "3CNTAR",
  "3TD",
  "3TR",
  "3TAD",
  "3CN",
  "3CNTAD",
  "เครดิต",
  "สด",
  "ลดหนี้ซื้อ",
  "เพิ่มหนี้ซื้อ",
  "Unknown",
  "ค่าใช้จ่าย",
  "ลดหนี้ค่าใช้จ่าย",
  "Expense Receipt",
  "Expense Credit Note",
] as const;

export type VatRegisterSide = "sales" | "purchase";
export type VatPaidStatus = "unpaid" | "paid";
export type VatFileKind = "invoice" | "receipt";

export type VatRegisterRow = {
  line_key: string;
  report_month: string;
  branch: string;
  side: VatRegisterSide;
  sheet: string;
  source: string;
  source_ref: string | null;
  bill_date: string;
  bill_no: string;
  display_bill_no: string;
  party_name: string | null;
  party_code: string | null;
  tax_id: string | null;
  before_vat: number;
  vat: number;
  after_vat: number;
  detail: string | null;
  remark: string | null;
  paid_status: VatPaidStatus;
  paid_on: string | null;
  paid_from_reminder: boolean;
  note: string | null;
  invoice_count: number;
  receipt_count: number;
  /** Accounting left this line out of the book. Totals skip it. */
  accounting_unused: boolean;
  /** Issued full invoice that replaces this abbreviated TAD. Totals skip the TAD. */
  full_invoice_docno: string | null;
};

export type VatRegisterFile = {
  id: string;
  kind: VatFileKind;
  url: string;
  content_type: string | null;
  uploaded_at: string;
};

export type VatExpenseImage = {
  name: string;
  url: string;
};

/** Same string Postgres md5() hashes for vw_vat_register.line_key. */
export function vatLineKey(parts: {
  branch: string;
  side: string;
  sheet: string;
  billNo: string;
  billDate: string;
  sourceRef?: string | null;
}): string {
  const raw = [
    parts.branch,
    parts.side,
    parts.sheet,
    parts.billNo,
    parts.billDate,
    parts.sourceRef ?? "",
  ].join("|");
  return createHash("md5").update(raw, "utf8").digest("hex");
}

/** Notebook reporting month: Bangkok today minus 10 days. */
export function vatReportingMonth(now = new Date()): string {
  const [year, month, day] = bangkokTodayIso(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 10);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthStartIso(month: string): string {
  return `${month}-01`;
}

/** Last calendar day of the month that monthStartIso (YYYY-MM-01) begins. */
export function monthEndIso(monthStart: string): string {
  const [year, month] = monthStart.slice(0, 7).split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthStart.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Sales and purchase books open the shared bill dialog. Expense rows do not. */
export function vatBillDrill(row: {
  source: string;
  side: VatRegisterSide;
  sheet: string;
  bill_no: string;
}): { billno: string; docType?: string; source: "sales" | "purchase" } | null {
  if (row.source === "expense" || row.source === "to_bill" || row.bill_no.trim() === "") {
    return null;
  }
  if (row.side === "purchase") return { billno: row.bill_no, source: "purchase" };
  return { billno: row.bill_no, docType: row.sheet, source: "sales" };
}

export function compareSheets(a: string, b: string): number {
  const ia = VAT_SHEET_ORDER.indexOf(a as (typeof VAT_SHEET_ORDER)[number]);
  const ib = VAT_SHEET_ORDER.indexOf(b as (typeof VAT_SHEET_ORDER)[number]);
  const ra = ia === -1 ? VAT_SHEET_ORDER.length : ia;
  const rb = ib === -1 ? VAT_SHEET_ORDER.length : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, "th");
}

/** Sales credit books, including the branch 3-prefix, plus purchase credit. */
const CREDIT_PAYMENT_SHEETS = new Set([
  "TD",
  "3TD",
  "TAD",
  "3TAD",
  "CNTAD",
  "3CNTAD",
  "เครดิต",
]);

export function vatTracksPayment(sheet: string): boolean {
  return CREDIT_PAYMENT_SHEETS.has(sheet);
}

/** Sales TD (including branch 3TD) and purchase credit need both documents. */
const RECEIPT_REQUIRED_SHEETS = new Set(["TD", "3TD", "เครดิต"]);

export function vatRequiresReceipt(sheet: string): boolean {
  return RECEIPT_REQUIRED_SHEETS.has(sheet);
}

export function vatDocumentsComplete(row: {
  sheet: string;
  invoice_count: number;
  receipt_count: number;
}): boolean {
  if (row.invoice_count === 0) return false;
  if (!vatRequiresReceipt(row.sheet)) return true;
  return row.receipt_count > 0;
}

export type VatRegisterKpiKey =
  | "missing_receipt"
  | "missing_invoice"
  | "unpaid"
  | "complete";

export type VatRegisterKpi = {
  total: number;
  missingReceipts: number;
  missingReceiptAmount: number;
  missingInvoices: number;
  missingInvoiceAmount: number;
  unpaid: number;
  unpaidAmount: number;
  complete: number;
  /** Rounded percent of lines that have the documents that sheet requires. */
  completePct: number;
};

type VatRegisterKpiRow = Pick<
  VatRegisterRow,
  "sheet" | "invoice_count" | "receipt_count" | "paid_status" | "after_vat"
>;

export function vatRegisterKpiMatch(
  row: Pick<VatRegisterRow, "sheet" | "invoice_count" | "receipt_count" | "paid_status">,
  key: VatRegisterKpiKey
): boolean {
  switch (key) {
    case "missing_receipt":
      return vatRequiresReceipt(row.sheet) && row.receipt_count === 0;
    case "missing_invoice":
      return row.invoice_count === 0;
    case "unpaid":
      return vatTracksPayment(row.sheet) && row.paid_status !== "paid";
    case "complete":
      return vatDocumentsComplete(row);
  }
}

/** Bill number, partner, or tax id. A blank query matches every line. */
export function vatRegisterMatchesQuery(
  row: Pick<
    VatRegisterRow,
    "bill_no" | "display_bill_no" | "party_name" | "party_code" | "tax_id"
  > & { full_invoice_docno?: string | null },
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    row.display_bill_no,
    row.bill_no,
    row.party_name,
    row.party_code,
    row.tax_id,
    row.full_invoice_docno,
  ].some((value) => value?.toLowerCase().includes(needle));
}

export type IssuedFullInvoice = {
  tad_billno: string;
  docno: string;
  customer_name: string;
  tax_id: string;
  before_vat: number;
  vat: number;
  after_vat: number;
};

export function fullInvoiceLineKey(docno: string, billDate: string, branch = "HQ"): string {
  return vatLineKey({
    branch,
    side: "sales",
    sheet: "TO",
    billNo: docno.trim().toUpperCase(),
    billDate: billDate.slice(0, 10),
    sourceRef: null,
  });
}

/** Abbreviated TAD stays on screen, marked unused, and the issued TO is the line that counts. */
export function applyIssuedFullInvoices(
  rows: VatRegisterRow[],
  invoices: IssuedFullInvoice[]
): VatRegisterRow[] {
  const byTad = new Map<string, IssuedFullInvoice>();
  for (const invoice of invoices) {
    const tad = invoice.tad_billno.trim().toUpperCase();
    const docno = invoice.docno.trim().toUpperCase();
    if (!tad.startsWith("TAD") || !/^TO\d{4}-\d{3,}$/.test(docno)) continue;
    byTad.set(tad, { ...invoice, tad_billno: tad, docno });
  }
  const out: VatRegisterRow[] = [];
  for (const row of rows) {
    const invoice =
      row.side === "sales" && row.sheet === "TAD"
        ? byTad.get(row.bill_no.trim().toUpperCase())
        : undefined;
    if (!invoice) {
      out.push({ ...row, full_invoice_docno: row.full_invoice_docno ?? null });
      continue;
    }
    const tadNo = row.bill_no.trim().toUpperCase();
    out.push({
      ...row,
      accounting_unused: true,
      full_invoice_docno: invoice.docno,
    });
    out.push({
      line_key: fullInvoiceLineKey(invoice.docno, row.bill_date, row.branch),
      report_month: row.report_month,
      branch: row.branch,
      side: "sales",
      sheet: "TO",
      source: "to_bill",
      source_ref: null,
      bill_date: row.bill_date,
      bill_no: invoice.docno,
      display_bill_no: invoice.docno,
      party_name: invoice.customer_name.trim() || null,
      party_code: null,
      tax_id: invoice.tax_id.trim() || null,
      before_vat: invoice.before_vat,
      vat: invoice.vat,
      after_vat: invoice.after_vat,
      detail: row.detail,
      remark: `อ้างอิง ${tadNo}`,
      paid_status: "unpaid",
      paid_on: null,
      paid_from_reminder: false,
      note: null,
      invoice_count: 0,
      receipt_count: 0,
      accounting_unused: false,
      full_invoice_docno: null,
    });
  }
  return out;
}

export type VatRegisterMoneyTotals = {
  before: number;
  vat: number;
  after: number;
  /** Lines accounting still uses. */
  used: number;
  /** Lines marked accounting-unused. They stay on screen and stay out of the sums. */
  unused: number;
};

/** Money totals for the lines accounting uses. Unused lines are counted, not summed. */
export function summarizeVatRegisterMoney(
  rows: Pick<VatRegisterRow, "before_vat" | "vat" | "after_vat" | "accounting_unused">[]
): VatRegisterMoneyTotals {
  const totals: VatRegisterMoneyTotals = {
    before: 0,
    vat: 0,
    after: 0,
    used: 0,
    unused: 0,
  };
  for (const row of rows) {
    if (row.accounting_unused) {
      totals.unused += 1;
      continue;
    }
    totals.used += 1;
    totals.before += row.before_vat;
    totals.vat += row.vat;
    totals.after += row.after_vat;
  }
  return totals;
}

type VatRegisterListRow = Pick<
  VatRegisterRow,
  | "bill_no"
  | "display_bill_no"
  | "party_name"
  | "party_code"
  | "tax_id"
  | "accounting_unused"
  | "sheet"
  | "invoice_count"
  | "receipt_count"
  | "paid_status"
>;

/**
 * Search narrows the list. A status chip then keeps in-use lines in that group.
 * A search still returns unused lines, so a bill can be found and marked again.
 */
export function filterVatRegisterRows<T extends VatRegisterListRow>(
  rows: T[],
  input: { query: string; kpi: VatRegisterKpiKey | null }
): T[] {
  const matched = rows.filter((row) => vatRegisterMatchesQuery(row, input.query));
  const kpi = input.kpi;
  if (kpi == null) return matched;
  const searching = input.query.trim() !== "";
  return matched.filter(
    (row) =>
      (searching && row.accounting_unused) ||
      (!row.accounting_unused && vatRegisterKpiMatch(row, kpi))
  );
}

/** Counts and net amounts for the lines currently in view. */
export function summarizeVatRegister(rows: VatRegisterKpiRow[]): VatRegisterKpi {
  const summary: VatRegisterKpi = {
    total: rows.length,
    missingReceipts: 0,
    missingReceiptAmount: 0,
    missingInvoices: 0,
    missingInvoiceAmount: 0,
    unpaid: 0,
    unpaidAmount: 0,
    complete: 0,
    completePct: 0,
  };

  for (const row of rows) {
    if (vatRegisterKpiMatch(row, "missing_receipt")) {
      summary.missingReceipts += 1;
      summary.missingReceiptAmount += row.after_vat;
    }
    if (vatRegisterKpiMatch(row, "missing_invoice")) {
      summary.missingInvoices += 1;
      summary.missingInvoiceAmount += row.after_vat;
    }
    if (vatRegisterKpiMatch(row, "unpaid")) {
      summary.unpaid += 1;
      summary.unpaidAmount += row.after_vat;
    }
    if (vatRegisterKpiMatch(row, "complete")) {
      summary.complete += 1;
    }
  }

  summary.completePct =
    rows.length === 0 ? 0 : Math.round((summary.complete / rows.length) * 100);
  return summary;
}
