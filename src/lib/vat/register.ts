import { createHash } from "crypto";

import { bangkokTodayIso } from "@/lib/bi/sales-periods";

export const VAT_SHEET_ORDER = [
  "TAR",
  "CNTAR",
  "TD",
  "TR",
  "TAD",
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
  if (row.source === "expense" || row.bill_no.trim() === "") return null;
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
  /** Rounded percent of lines that have both an invoice and a receipt. */
  completePct: number;
};

type VatRegisterKpiRow = Pick<
  VatRegisterRow,
  "invoice_count" | "receipt_count" | "paid_status" | "after_vat"
>;

export function vatRegisterKpiMatch(
  row: Pick<VatRegisterRow, "invoice_count" | "receipt_count" | "paid_status">,
  key: VatRegisterKpiKey
): boolean {
  switch (key) {
    case "missing_receipt":
      return row.receipt_count === 0;
    case "missing_invoice":
      return row.invoice_count === 0;
    case "unpaid":
      return row.paid_status !== "paid";
    case "complete":
      return row.invoice_count > 0 && row.receipt_count > 0;
  }
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
