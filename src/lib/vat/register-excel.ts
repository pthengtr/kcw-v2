import type { VatRegisterRow, VatRegisterSide } from "@/lib/vat/register";

/**
 * Sheet layout of the monthly VAT books written by kcw-analytic notebooks
 * 31_vat_purchase_report_excel and 32_vat_sales_report_excel.
 */

export const HQ_COMPANY = {
  name: "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สำนักงานใหญ่)",
  address: "305 หมู่ 1 ต.ชุมแสง อ.วังจันทร์ จ.ระยอง 21210",
  taxId: "0215560000262",
} as const;

export const SYP_COMPANY = {
  name: "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สาขาที่ 00003)",
  address: "16/2 หมู่ 2 ต.ห้วยทับมอญ อ.เขาชะเมา จ.ระยอง 21110",
  taxId: "0215560000262",
} as const;

export const SALES_COLUMNS = [
  "ลำดับ",
  "วันที่",
  "เลขที่",
  "ชื่อผู้ซื้อสินค้า",
  "เลขผู้เสียภาษี",
  "มูลค่าสินค้า",
  "ภาษีมูลค่าเพิ่ม",
  "ยอดสุทธิ",
  "รายการสินค้า",
  "หมายเหตุ",
] as const;

export const PURCHASE_COLUMNS = [
  "ลำดับ",
  "วันที่",
  "เลขที่",
  "ชื่อผู้ขายสินค้า",
  "เลขผู้เสียภาษี",
  "มูลค่าสินค้า",
  "ภาษีมูลค่าเพิ่ม",
  "ยอดสุทธิ",
  "รายการสินค้า",
  "หมายเหตุ",
] as const;

const TOTAL_SUM_COLUMNS = new Set(["มูลค่าสินค้า", "ภาษีมูลค่าเพิ่ม", "ยอดสุทธิ"]);

const PLATFORMS: readonly [string, string][] = [
  ["lazada", "คุณลูกค้าทั่วไป Lazada"],
  ["shopee", "คุณลูกค้าทั่วไป Shopee"],
  ["tiktok", "คุณลูกค้าทั่วไป Tiktok"],
];

const SALES_HQ = [
  { sheet: "TAR", title: "รายงานภาษีขาย (TAR)" },
  { sheet: "CNTAR", title: "รายงานภาษีขาย (CNTAR)" },
  { sheet: "TD", title: "รายงานภาษีขาย (TD)" },
  { sheet: "TR", title: "รายงานภาษีขาย (TR)" },
  { sheet: "TAD", title: "รายงานภาษีขาย (TAD)" },
  { sheet: "TO", title: "รายงานภาษีขาย (TO)" },
  { sheet: "CN", title: "รายงานภาษีขาย (CN)" },
  { sheet: "CNTAD", title: "รายงานภาษีขาย (CNTAD)" },
] as const;

const SALES_SYP = [
  { sheet: "3TAR", title: "รายงานภาษีขาย (3TAR)" },
  { sheet: "3CNTAR", title: "รายงานภาษีขาย (3CNTAR)" },
  { sheet: "3TD", title: "รายงานภาษีขาย (3TD)" },
  { sheet: "3TR", title: "รายงานภาษีขาย (3TR)" },
  { sheet: "3TAD", title: "รายงานภาษีขาย (3TAD)" },
  { sheet: "3CN", title: "รายงานภาษีขาย (3CN)" },
  { sheet: "3CNTAD", title: "รายงานภาษีขาย (3CNTAD)" },
] as const;

const PURCHASE_HQ = [
  { sheet: "เครดิต", title: "รายงานภาษีซื้อ" },
  { sheet: "สด", title: "รายงานภาษีซื้อ" },
  { sheet: "ลดหนี้ซื้อ", title: "รายงานภาษีซื้อ" },
  { sheet: "เพิ่มหนี้ซื้อ", title: "รายงานภาษีซื้อ" },
  { sheet: "Unknown", title: "รายงานภาษีซื้อ" },
  { sheet: "ลดหนี้ค่าใช้จ่าย", title: "รายงานภาษีซื้อ (Expense Credit Note)" },
  { sheet: "ค่าใช้จ่าย", title: "รายงานภาษีซื้อ (Expense Receipt)" },
] as const;

const PURCHASE_SYP = [
  { sheet: "Expense Credit Note", title: "รายงานภาษีซื้อ (Expense Credit Note)" },
  { sheet: "Expense Receipt", title: "รายงานภาษีซื้อ (Expense Receipt)" },
] as const;

export type VatCell = string | number;

export type VatSheet = {
  name: string;
  title: string;
  columns: readonly string[];
  rows: VatCell[][];
};

export type VatCompany = {
  name: string;
  address: string;
  taxId: string;
};

export type VatWorkbookFile = {
  filename: string;
  company: VatCompany;
  sheets: VatSheet[];
};

export type VatExportScope = {
  month: string;
  branch: "ALL" | "HQ" | "SYP";
  side: "ALL" | VatRegisterSide;
};

type BookLine = {
  dateIso: string;
  rawBill: string;
  party: string;
  taxId: string;
  before: number;
  vat: number;
  after: number;
  detail: string;
  remark: string;
};

type DisplayLine = {
  dateIso: string;
  bill: string;
  party: string;
  taxId: string;
  before: number;
  vat: number;
  after: number;
  detail: string;
  remark: string;
};

const BILL_RE = /^(3CNTAR|3TAR|CNTAR|TAR)(\d{4})-?(\d{3})$/;

export function vatThaiDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${Number(match[1]) + 543}`;
}

/** Detail sheets show the last 13 characters. 3CNTAR is rewritten to 3CTAR first. */
export function excelBillNo(billNo: string, sheet: string): string {
  const rewritten =
    sheet === "3CNTAR" && billNo.startsWith("3CNTAR")
      ? `3CTAR${billNo.slice("3CNTAR".length)}`
      : billNo;
  return rewritten.slice(-13);
}

/** TAR / CNTAR daily bill range, same rules as notebook compact_bill_range. */
export function compactBillRange(firstBill: string, lastBill: string): string {
  const m1 = BILL_RE.exec(firstBill);
  const m2 = BILL_RE.exec(lastBill);
  if (!m1 || !m2) return `${firstBill} - ${lastBill}`;
  const [, p1, yymm1, seq1] = m1;
  const [, p2, yymm2, seq2] = m2;
  if (p1 !== p2 || yymm1 !== yymm2) return `${firstBill} - ${lastBill}`;
  if (p1 === "TAR" || p1 === "3TAR") {
    const prefix = p1 === "TAR" ? "R" : "3";
    if (seq1 === seq2) return `${prefix}${yymm1}-${seq1}`;
    return `${prefix}${yymm1}-${seq1}-${seq2}`;
  }
  if (p1 === "CNTAR" || p1 === "3CNTAR") {
    const restore = (bill: string) => {
      const match = /^(3CNTAR|CNTAR)(\d{4})(\d{3})$/.exec(bill);
      return match ? `${match[1]}${match[2]}-${match[3]}` : bill;
    };
    const first = restore(firstBill);
    const last = restore(lastBill);
    return first === last ? first : `${first} - ${last}`;
  }
  return `${firstBill} - ${lastBill}`;
}

/** TAD / CNTAD marketplace names, matching normalize_acctname_platform. */
export function vatBuyerName(sheet: string, name: string | null): string {
  const text = (name ?? "").trim();
  if (sheet !== "TAD" && sheet !== "CNTAD") return text;
  const lower = text.toLowerCase();
  let out = text;
  for (const [key, label] of PLATFORMS) {
    if (lower.includes(key)) out = label;
  }
  return out;
}

export function vatReportFilename(
  kind: "sales" | "purchases",
  branch: "HQ" | "SYP",
  month: string
): string {
  const [year, mm] = month.split("-");
  const prefix = kind === "sales" ? "vat_sales_report" : "vat_purchases_report";
  return `${prefix}_${year}_${mm}_${branch.toLowerCase()}.xlsx`;
}

function cmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sumMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0);
  return cents / 100;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function bookLines(rows: VatRegisterRow[], branch: string, sheet: string): BookLine[] {
  return rows
    .filter((row) => row.branch === branch && row.sheet === sheet && !row.accounting_unused)
    .map((row) => ({
      dateIso: row.bill_date.slice(0, 10),
      rawBill: row.bill_no,
      party: vatBuyerName(sheet, row.party_name),
      taxId: (row.tax_id ?? "").trim(),
      before: row.before_vat,
      vat: row.vat,
      after: row.after_vat,
      detail: (row.detail ?? "").trim(),
      remark: (row.remark ?? "").trim(),
    }))
    .sort((a, b) => cmp(a.dateIso, b.dateIso) || cmp(a.rawBill, b.rawBill));
}

function toDisplay(lines: BookLine[], sheet: string): DisplayLine[] {
  return lines.map((line) => ({
    dateIso: line.dateIso,
    bill: excelBillNo(line.rawBill, sheet),
    party: line.party,
    taxId: line.taxId,
    before: line.before,
    vat: line.vat,
    after: line.after,
    detail: line.detail,
    remark: line.remark,
  }));
}

function groupVatByDate(lines: BookLine[]): DisplayLine[] {
  const sorted = [...lines].sort(
    (a, b) => cmp(a.dateIso, b.dateIso) || cmp(a.rawBill, b.rawBill)
  );
  const groups: BookLine[][] = [];
  for (const line of sorted) {
    const last = groups[groups.length - 1];
    if (!last || last[0].dateIso !== line.dateIso) groups.push([line]);
    else last.push(line);
  }
  return groups.map((group) => ({
    dateIso: group[0].dateIso,
    bill: compactBillRange(group[0].rawBill, group[group.length - 1].rawBill),
    party: group[0].party,
    taxId: group[0].taxId,
    before: sumMoney(group.map((line) => line.before)),
    vat: sumMoney(group.map((line) => line.vat)),
    after: sumMoney(group.map((line) => line.after)),
    detail: group[0].detail,
    remark: group[0].remark,
  }));
}

function lineCell(column: string, line: DisplayLine, index: number): VatCell {
  switch (column) {
    case "ลำดับ":
      return index + 1;
    case "วันที่":
      return vatThaiDate(line.dateIso);
    case "เลขที่":
      return line.bill;
    case "ชื่อผู้ซื้อสินค้า":
    case "ชื่อผู้ขายสินค้า":
    case "ชื่อลูกค้า":
      return line.party;
    case "เลขผู้เสียภาษี":
      return line.taxId;
    case "มูลค่าสินค้า":
      return line.before;
    case "ภาษีมูลค่าเพิ่ม":
      return line.vat;
    case "ยอดสุทธิ":
    case "ยอดรวมสุทธิ":
      return line.after;
    case "รายการสินค้า":
      return line.detail;
    case "หมายเหตุ":
      return line.remark;
    default:
      return "";
  }
}

function totalRow(columns: readonly string[], body: VatCell[][]): VatCell[] {
  return columns.map((column, index) => {
    if (column === "เลขที่") return "รวม";
    if (!TOTAL_SUM_COLUMNS.has(column)) return "";
    return sumMoney(
      body.map((row) => (typeof row[index] === "number" ? row[index] : 0))
    );
  });
}

function sheetFromLines(
  name: string,
  title: string,
  columns: readonly string[],
  lines: DisplayLine[]
): VatSheet {
  const body = lines.map((line, index) =>
    columns.map((column) => lineCell(column, line, index))
  );
  return {
    name,
    title,
    columns,
    rows: body.length > 0 ? [...body, totalRow(columns, body)] : [],
  };
}

function byDisplay(a: DisplayLine, b: DisplayLine): number {
  return cmp(a.dateIso, b.dateIso) || cmp(a.bill, b.bill);
}

function dailySummarySheet(
  name: string,
  title: string,
  sales: DisplayLine[],
  returns: DisplayLine[],
  salesBillCol: string,
  salesAmtCol: string,
  returnBillCol: string,
  returnAmtCol: string
): VatSheet | null {
  const columns = [
    "ลำดับ",
    "วันที่",
    "ชื่อลูกค้า",
    "เลขผู้เสียภาษี",
    salesBillCol,
    salesAmtCol,
    returnBillCol,
    returnAmtCol,
    "มูลค่าสินค้า",
    "ภาษีมูลค่าเพิ่ม",
    "ยอดรวมสุทธิ",
  ];
  const byDate = new Map<string, { sale?: DisplayLine; ret?: DisplayLine }>();
  for (const line of sales) byDate.set(line.dateIso, { ...byDate.get(line.dateIso), sale: line });
  for (const line of returns) byDate.set(line.dateIso, { ...byDate.get(line.dateIso), ret: line });
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return null;
  const body: VatCell[][] = dates.map((date, index) => {
    const slot = byDate.get(date);
    const salesAmt = slot?.sale?.after ?? 0;
    const returnAmt = slot?.ret?.after ?? 0;
    const net = sumMoney([salesAmt, returnAmt]);
    const before = round2(net / 1.07);
    const vat = round2(net - before);
    return [
      index + 1,
      vatThaiDate(date),
      "คุณลูกค้าทั่วไป",
      "0000000000000",
      slot?.sale?.bill ?? "",
      salesAmt,
      slot?.ret?.bill ?? "",
      returnAmt,
      before,
      vat,
      net,
    ];
  });
  return { name, title, columns, rows: [...body, totalRow(columns, body)] };
}

function salesWorkbook(
  rows: VatRegisterRow[],
  branch: "HQ" | "SYP",
  month: string
): VatWorkbookFile | null {
  const specs = branch === "HQ" ? SALES_HQ : SALES_SYP;
  const tarSheet = branch === "HQ" ? "TAR" : "3TAR";
  const cntarSheet = branch === "HQ" ? "CNTAR" : "3CNTAR";
  const detailSheets: VatSheet[] = [];
  const dailySheets: VatSheet[] = [];
  const combined: DisplayLine[] = [];
  let tarDaily: DisplayLine[] = [];
  let cntarDaily: DisplayLine[] = [];

  for (const spec of specs) {
    const lines = bookLines(rows, branch, spec.sheet);
    if (lines.length === 0) continue;
    const displayed = toDisplay(lines, spec.sheet);
    detailSheets.push(sheetFromLines(spec.sheet, spec.title, SALES_COLUMNS, displayed));
    if (spec.sheet === tarSheet || spec.sheet === cntarSheet) {
      const daily = groupVatByDate(lines);
      dailySheets.push(
        sheetFromLines(
          `${spec.sheet} (รายวัน)`,
          `รายงานภาษีขาย (${spec.sheet}) สรุปรายวัน`,
          SALES_COLUMNS,
          daily
        )
      );
      if (spec.sheet === tarSheet) tarDaily = daily;
      else cntarDaily = daily;
    }
    if (spec.sheet === tarSheet) combined.push(...tarDaily);
    else combined.push(...displayed);
  }

  const sheets = [...detailSheets, ...dailySheets];
  if (combined.length > 0) {
    sheets.push(
      sheetFromLines("รวม", "รายงานภาษีขาย (รวม)", SALES_COLUMNS, [...combined].sort(byDisplay))
    );
  }
  const summary = dailySummarySheet(
    branch === "HQ" ? "สรุป TAR CNTAR (รายวัน)" : "สรุป 3TAR 3CNTAR (รายวัน)",
    branch === "HQ"
      ? "รายงานภาษีขาย (TAR/CNTAR) สรุปรายวัน"
      : "รายงานภาษีขาย (3TAR/3CNTAR) สรุปรายวัน",
    tarDaily,
    cntarDaily,
    branch === "HQ" ? "เลขที่ TAR" : "เลขที่ 3TAR",
    branch === "HQ" ? "ยอดรวม TAR" : "ยอดรวม 3TAR",
    branch === "HQ" ? "เลขที่ CNTAR" : "เลขที่ 3CNTAR",
    branch === "HQ" ? "ยอดรวม CNTAR" : "ยอดรวม 3CNTAR"
  );
  if (summary) sheets.push(summary);
  if (sheets.length === 0) return null;
  return {
    filename: vatReportFilename("sales", branch, month),
    company: branch === "HQ" ? HQ_COMPANY : SYP_COMPANY,
    sheets,
  };
}

function purchaseWorkbook(
  rows: VatRegisterRow[],
  branch: "HQ" | "SYP",
  month: string
): VatWorkbookFile {
  const specs = branch === "HQ" ? PURCHASE_HQ : PURCHASE_SYP;
  const combined: DisplayLine[] = [];
  const sheets = specs.map((spec) => {
    const displayed = toDisplay(bookLines(rows, branch, spec.sheet), spec.sheet);
    if (displayed.length > 0) combined.push(...displayed);
    return sheetFromLines(spec.sheet, spec.title, PURCHASE_COLUMNS, displayed);
  });
  sheets.push(
    sheetFromLines(
      "รวม",
      "รายงานภาษีซื้อ (รวม)",
      PURCHASE_COLUMNS,
      [...combined].sort(byDisplay)
    )
  );
  return {
    filename: vatReportFilename("purchases", branch, month),
    company: branch === "HQ" ? HQ_COMPANY : SYP_COMPANY,
    sheets,
  };
}

/** One workbook per branch and side, using the Drive filenames. Empty sales books are omitted. */
export function vatRegisterWorkbookFiles(
  rows: VatRegisterRow[],
  scope: VatExportScope
): VatWorkbookFile[] {
  const branches: ("HQ" | "SYP")[] = scope.branch === "ALL" ? ["HQ", "SYP"] : [scope.branch];
  const files: VatWorkbookFile[] = [];
  for (const branch of branches) {
    if (scope.side !== "purchase") {
      const sales = salesWorkbook(rows, branch, scope.month);
      if (sales) files.push(sales);
    }
    if (scope.side !== "sales") files.push(purchaseWorkbook(rows, branch, scope.month));
  }
  return files;
}
