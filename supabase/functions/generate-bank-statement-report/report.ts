/**
 * Monthly multi-account bank statement Excel report.
 * Port of kcw-analytics `src/kcw/bank_statement_report.py` (layout + enrich rules).
 */
import ExcelJS from "npm:exceljs@4.4.0";

export const COMPANY_NAME =
  "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สำนักงานใหญ่)";
export const COMPANY_ADDRESS =
  "305 หมู่ 1 ต.ชุมแสง อ.วังจันทร์ จ.ระยอง 21210";
export const TAX_ID = "0215560000262";

export const COLUMN_ORDER = [
  "ลำดับ",
  "วันที่",
  "วันที่มีผล",
  "รายการ",
  "ช่องทาง",
  "รายละเอียด",
  "อ้างอิง",
  "ถอนเงิน",
  "ฝากเงิน",
  "ยอดคงเหลือ",
  "แหล่งไฟล์",
  "เหตุผลการจับคู่",
  "สถานะจับคู่",
] as const;

export type ReportColumn = (typeof COLUMN_ORDER)[number];

const DONE_MATCH_STATUSES = new Set(["matched", "manual", "resolved"]);

const CHANNEL_KEYS = [
  "ช่องทาง",
  "channel",
  "Channel",
  "CHANNEL",
  "Teller Id",
  "Teller ID",
  "Init Br.",
] as const;

const TXN_TYPE_KEYS = ["รายการ", "Transaction Code", "TRANSACTION CODE"] as const;

const DETAIL_KEYS = [
  "รายละเอียด",
  "Description",
  "DESCRIPTION",
  "Particular",
  "PARTICULAR",
] as const;

const TIME_KEYS = [
  "เวลา/วันที่ ทำรายการ",
  "เวลา/ วันที่มีผล",
  "เวลา",
  "TIME",
  "Time",
] as const;

export type StatementLineRow = {
  account_no: string | null;
  bank_name: string | null;
  txn_date: string | null;
  value_date: string | null;
  description: string | null;
  bank_reference: string | null;
  amount: number | null;
  direction: string | null;
  debit: number | null;
  credit: number | null;
  balance_after: number | null;
  raw_json: unknown;
  source_row_number: number | null;
  source_file_id: string | null;
  match_status: string | null;
  match_reason: string | null;
  match_notes: string | null;
  matched_ref_type: string | null;
  matched_ref_id: string | null;
  match_confidence: number | null;
  original_filename: string | null;
};

export type EnrichedRow = Record<ReportColumn, string | number | Date | null> & {
  account_no: string;
  bank_name: string;
  source_row_number: number | null;
};

function parseRawJson(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function pickRawValue(
  raw: Record<string, unknown>,
  keys: readonly string[],
  exactOnly = false,
): string {
  if (!raw || Object.keys(raw).length === 0) return "";

  for (const key of keys) {
    if (key in raw && raw[key] != null) {
      const text = String(raw[key]).trim();
      if (text && !["nan", "none", "<na>"].includes(text.toLowerCase())) {
        return text;
      }
    }
  }

  const lowered = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw)) {
    lowered.set(String(k).trim().toLowerCase(), v);
  }
  for (const key of keys) {
    const v = lowered.get(key.toLowerCase());
    if (v != null) {
      const text = String(v).trim();
      if (text && !["nan", "none", "<na>"].includes(text.toLowerCase())) {
        return text;
      }
    }
  }

  if (exactOnly) return "";

  for (const [rk, rv] of Object.entries(raw)) {
    const rkL = String(rk).trim().toLowerCase();
    if (rkL.includes("เวลา") || rkL.includes("time")) continue;
    for (const key of keys) {
      if (rkL.includes(key.toLowerCase()) && rv != null) {
        const text = String(rv).trim();
        if (text && !["nan", "none", "<na>"].includes(text.toLowerCase())) {
          return text;
        }
      }
    }
  }
  return "";
}

export function extractRawFields(rawJson: unknown): {
  txnType: string;
  channel: string;
  detail: string;
  timeStr: string;
} {
  const raw = parseRawJson(rawJson);
  return {
    txnType: pickRawValue(raw, TXN_TYPE_KEYS, true),
    channel: pickRawValue(raw, CHANNEL_KEYS, true),
    detail: pickRawValue(raw, DETAIL_KEYS, true),
    timeStr: pickRawValue(raw, TIME_KEYS, true),
  };
}

function looksLikeTime(value: unknown): boolean {
  if (value == null) return false;
  const text = String(value).trim();
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(text);
}

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMatchReason(row: StatementLineRow): string {
  const parts: string[] = [];
  const reason = row.match_reason?.trim();
  const notes = row.match_notes?.trim();
  const refType = row.matched_ref_type?.trim();
  const refId = row.matched_ref_id?.trim();
  const conf = row.match_confidence;

  if (reason) parts.push(reason);
  const refBits = [refType, refId].filter(Boolean);
  if (refBits.length) parts.push(refBits.join(" / "));
  if (notes) parts.push(notes);
  if (conf != null && String(conf).trim() !== "") {
    const n = Number(conf);
    parts.push(
      Number.isFinite(n) ? `confidence=${n.toFixed(2)}` : `confidence=${conf}`,
    );
  }
  return parts.join("\n");
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function enrichStatementRows(rows: StatementLineRow[]): EnrichedRow[] {
  return rows.map((row) => {
    const { txnType, channel, detail, timeStr } = extractRawFields(row.raw_json);

    let description = "";
    if (txnType) {
      description = txnType;
    } else if (!looksLikeTime(row.description) && row.description) {
      description = String(row.description);
    }

    let valueDisplay: string | Date | null = null;
    const vd = row.value_date;
    if (vd && !looksLikeTime(vd)) {
      valueDisplay = parseDate(vd) ?? vd;
    } else if (timeStr) {
      valueDisplay = timeStr;
    } else if (vd) {
      valueDisplay = vd;
    }

    let status = (row.match_status ?? "").trim();
    if (!status || status === "None" || status === "nan") status = "pending";

    return {
      account_no: String(row.account_no ?? "").trim() || "UNKNOWN",
      bank_name: String(row.bank_name ?? "").trim() || "BANK",
      source_row_number: row.source_row_number,
      ลำดับ: 0,
      วันที่: parseDate(row.txn_date),
      วันที่มีผล: valueDisplay,
      รายการ: description,
      ช่องทาง: channel,
      รายละเอียด: detail,
      อ้างอิง: row.bank_reference ? String(row.bank_reference) : "",
      ถอนเงิน: toNum(row.debit),
      ฝากเงิน: toNum(row.credit),
      ยอดคงเหลือ: toNum(row.balance_after),
      แหล่งไฟล์: row.original_filename ? String(row.original_filename) : "",
      เหตุผลการจับคู่: formatMatchReason(row),
      สถานะจับคู่: status,
    };
  });
}

export function sheetNameForAccount(bankName: string, accountNo: string): string {
  let name = `${bankName}_${accountNo}`.replace(/[:\\/?*[\]]/g, "_");
  return name.slice(0, 31);
}

export function buildAccountSheets(
  rows: EnrichedRow[],
): Map<string, EnrichedRow[]> {
  const groups = new Map<string, EnrichedRow[]>();
  for (const row of rows) {
    const key = `${row.bank_name}\0${row.account_no}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const sheets = new Map<string, EnrichedRow[]>();
  const sortedKeys = [...groups.keys()].sort();
  for (const key of sortedKeys) {
    const group = groups.get(key)!;
    group.sort((a, b) => {
      const da = a.วันที่ instanceof Date ? a.วันที่.getTime() : 0;
      const db = b.วันที่ instanceof Date ? b.วันที่.getTime() : 0;
      if (da !== db) return da - db;
      const sa = a.source_row_number ?? 0;
      const sb = b.source_row_number ?? 0;
      return sa - sb;
    });
    group.forEach((r, i) => {
      r.ลำดับ = i + 1;
    });

    const [bank, acct] = key.split("\0");
    let name = sheetNameForAccount(bank, acct);
    const base = name;
    let i = 2;
    while (sheets.has(name)) {
      const suffix = `_${i}`;
      name = base.slice(0, 31 - suffix.length) + suffix;
      i += 1;
    }
    sheets.set(name, group);
  }
  return sheets;
}

export function matchStatusCounts(
  rows: EnrichedRow[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const s = String(row.สถานะจับคู่ || "pending");
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

export function reportingYearMonth(asOf = new Date()): { year: number; month: number } {
  // Asia/Bangkok today − 10 days (VAT-style), matching kcw-analytics.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asOf);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const bangkok = new Date(Date.UTC(y, m - 1, d));
  bangkok.setUTCDate(bangkok.getUTCDate() - 10);
  return { year: bangkok.getUTCFullYear(), month: bangkok.getUTCMonth() + 1 };
}

export function monthBounds(year: number, month: number): {
  start: string;
  end: string;
} {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  return { start, end };
}

function fillWarning(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return Boolean(s) && !DONE_MATCH_STATUSES.has(s);
}

export async function buildWorkbookBuffer(
  sheets: Map<string, EnrichedRow[]>,
  year: number,
  month: number,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "kcw-v2";
  wb.created = new Date();

  const titleName = `รายงานเดินบัญชีธนาคาร ประจำเดือน ${String(month).padStart(2, "0")}/${year}`;
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3DFD2" },
  };
  const warningFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" },
  };
  const thin: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: "FF000000" },
  };
  const border: Partial<ExcelJS.Borders> = {
    top: thin,
    left: thin,
    bottom: thin,
    right: thin,
  };

  const entries =
    sheets.size > 0
      ? [...sheets.entries()]
      : ([["NO_DATA", []]] as [string, EnrichedRow[]][]);

  for (const [sheetName, rows] of entries) {
    const ws = wb.addWorksheet(sheetName.slice(0, 31));
    const lastCol = Math.max(COLUMN_ORDER.length, 8);
    const endLetter = colLetter(lastCol);

    ws.mergeCells(`A1:${endLetter}1`);
    const titleCell = ws.getCell("A1");
    titleCell.value = `${titleName} — ${sheetName}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    ws.mergeCells("A3:C3");
    ws.getCell("A3").value = "ชื่อสถานประกอบกิจการ";
    ws.getCell("A3").font = { bold: true };
    ws.mergeCells("D3:F3");
    ws.getCell("D3").value = COMPANY_NAME;

    ws.mergeCells("A4:C4");
    ws.getCell("A4").value = "ที่อยู่สถานประกอบกิจการ";
    ws.getCell("A4").font = { bold: true };
    ws.mergeCells("D4:F4");
    ws.getCell("D4").value = COMPANY_ADDRESS;

    ws.mergeCells("A5:C5");
    ws.getCell("A5").value = "เลขประจำตัวผู้เสียภาษี";
    ws.getCell("A5").font = { bold: true };
    ws.mergeCells("D5:F5");
    ws.getCell("D5").value = TAX_ID;

    const startRow = 7;
    const headerRow = ws.getRow(startRow);
    COLUMN_ORDER.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col;
      cell.font = { bold: true };
      cell.fill = headerFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border as ExcelJS.Borders;
    });

    let debitSum = 0;
    let creditSum = 0;
    rows.forEach((row, i) => {
      const r = startRow + 1 + i;
      const excelRow = ws.getRow(r);
      const warn = fillWarning(row.สถานะจับคู่);
      const debit = typeof row.ถอนเงิน === "number" ? row.ถอนเงิน : 0;
      const credit = typeof row.ฝากเงิน === "number" ? row.ฝากเงิน : 0;
      debitSum += debit || 0;
      creditSum += credit || 0;

      COLUMN_ORDER.forEach((col, idx) => {
        const cell = excelRow.getCell(idx + 1);
        const value = row[col];
        if (col === "วันที่" && value instanceof Date) {
          cell.value = value;
          cell.numFmt = "dd/mm/yyyy";
        } else if (
          (col === "ถอนเงิน" || col === "ฝากเงิน" || col === "ยอดคงเหลือ") &&
          typeof value === "number"
        ) {
          cell.value = value;
          cell.numFmt = "#,##0.00";
        } else if (value instanceof Date) {
          cell.value = value;
          cell.numFmt = "dd/mm/yyyy";
        } else {
          cell.value = value == null ? null : value;
        }
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        cell.border = border as ExcelJS.Borders;
        if (warn) cell.fill = warningFill;
      });
    });

    // Total row
    const totalRowIdx = startRow + 1 + rows.length;
    const totalRow = ws.getRow(totalRowIdx);
    COLUMN_ORDER.forEach((col, idx) => {
      const cell = totalRow.getCell(idx + 1);
      if (col === "รายการ") cell.value = "รวม";
      else if (col === "ถอนเงิน") {
        cell.value = debitSum;
        cell.numFmt = "#,##0.00";
      } else if (col === "ฝากเงิน") {
        cell.value = creditSum;
        cell.numFmt = "#,##0.00";
      } else {
        cell.value = "";
      }
      cell.border = border as ExcelJS.Borders;
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });

    ws.views = [{ state: "frozen", ySplit: startRow }];

    COLUMN_ORDER.forEach((col, idx) => {
      let maxLen = String(col).length;
      for (const row of rows) {
        const v = row[col];
        const len = v == null ? 0 : String(v).length;
        if (len > maxLen) maxLen = len;
      }
      ws.getColumn(idx + 1).width = Math.min(maxLen + 2, 60);
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
