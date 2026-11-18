/** TAR / CNTAR / 3TAR / 3CNTAR are printed from the lines already stored in billgen. */
const GENERATED_SHEETS = new Set(["TAR", "CNTAR", "3TAR", "3CNTAR"]);

/**
 * Online abbreviated tax invoices (TAD/CNTAD) attach automatically from this
 * bill date onward (1 พ.ย. 2569) — no staff upload.
 */
export const ONLINE_TAX_AUTO_ATTACH_FROM = "2026-11-01";

const ONLINE_TAX_SHEETS = new Set(["TAD", "CNTAD", "3TAD", "3CNTAD"]);

const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export type ReceiptCompany = {
  name: string;
  address: string;
  phone: string;
  tax: string;
};

const HQ_RECEIPT: ReceiptCompany = {
  name: "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สำนักงานใหญ่)",
  address: "ที่อยู่ 305 ม.1 ต.ชุมแสง อ.วังจันทร์ จ.ระยอง 21210",
  phone: "โทร. 038-666-078",
  tax: "เลขประจำตัวผู้เสียภาษี 0215560000262",
};

const SYP_RECEIPT: ReceiptCompany = {
  name: "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สาขาสี่แยกพัฒนา)",
  address: "ที่อยู่ 16/2 ม.2 ต.ห้วยทับมอญ อ.เขาชะเมา จ.ระยอง 21110",
  phone: "โทร. 063-2655387, 038-015818",
  tax: "เลขประจำตัวผู้เสียภาษี 0215560000262 (สาขาที่ 00003)",
};

/** TAR family always; TAD/CNTAD from ONLINE_TAX_AUTO_ATTACH_FROM when billDate is set. */
export function isGeneratedVatBill(
  sheet: string,
  billDate?: string | null
): boolean {
  if (GENERATED_SHEETS.has(sheet)) return true;
  if (!ONLINE_TAX_SHEETS.has(sheet)) return false;
  const day = (billDate ?? "").trim().slice(0, 10);
  return day !== "" && day >= ONLINE_TAX_AUTO_ATTACH_FROM;
}

/** The on-screen bill counts as the invoice, so these rows are not missing a document. */
export function displayInvoiceCount(
  sheet: string,
  uploaded: number,
  billDate?: string | null
): number {
  return uploaded + (isGeneratedVatBill(sheet, billDate) ? 1 : 0);
}

export function receiptCompany(sheet: string): ReceiptCompany {
  return sheet.startsWith("3") ? SYP_RECEIPT : HQ_RECEIPT;
}

export function receiptTitle(sheet: string): string {
  if (sheet === "CNTAD" || sheet === "3CNTAD") return "ใบลดหนี้/ใบกำกับภาษี";
  if (sheet === "CNTAR" || sheet === "3CNTAR") return "ใบลดหนี้";
  if (sheet === "TAD" || sheet === "3TAD") return "ใบกำกับภาษีอย่างย่อ/ใบส่งสินค้า";
  return "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ";
}

/** 3CNTAR bills are printed as 3CTAR, matching the numbered series. */
export function printedBillNo(sheet: string, billNo: string): string {
  const trimmed = billNo.trim();
  if (sheet === "3CNTAR" && trimmed.startsWith("3CNTAR")) {
    return `3CTAR${trimmed.slice("3CNTAR".length)}`;
  }
  return trimmed;
}

export function thaiReceiptDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return "";
  const month = Number(match[2]);
  if (month < 1 || month > 12) return "";
  return `${Number(match[3])} ${TH_MONTHS[month - 1]} ${Number(match[1]) + 543}`;
}

export function formatReceiptMoney(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatReceiptQty(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value % 1 === 0) return String(Math.trunc(value));
  return formatReceiptMoney(value);
}

/** Inclusive line amounts, split the same way as the printed TAR bill (amount × 7/107). */
export function receiptTotals(amounts: number[]): { base: number; vat: number; total: number } {
  let base = 0;
  let vat = 0;
  let total = 0;
  for (const amount of amounts) {
    const value = Number.isFinite(amount) ? amount : 0;
    const lineVat = value * (7 / 107);
    vat += lineVat;
    base += value - lineVat;
    total += value;
  }
  return { base, vat, total };
}
