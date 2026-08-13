/**
 * Monthly multi-account bank statement Excel report.
 * Pure presentation helpers for the monthly bank statement Excel report.
 * (No Deno/ExcelJS imports — safe for Vitest.)
 */
export const COMPANY_NAME =
  "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด (สำนักงานใหญ่)";
export const COMPANY_ADDRESS =
  "305 หมู่ 1 ต.ชุมแสง อ.วังจันทร์ จ.ระยอง 21210";
export const TAX_ID = "0215560000262";

export const COLUMN_ORDER = [
  "#",
  "วันที่",
  "รายการ / ชื่อบริษัท",
  "ประเภท",
  "เลขที่บิล",
  "ถอนเงิน",
  "ฝากเงิน",
  "ยอดคงเหลือ",
  "หมายเหตุ",
] as const;

export type ReportColumn = (typeof COLUMN_ORDER)[number];

const DONE_MATCH_STATUSES = new Set(["matched", "manual", "resolved"]);

const UNMATCHED_NOTE = "ยังไม่พบรายการจับคู่";

/** Short human-readable document / reconciliation type for ประเภท. */
const REMARK_BY_REF_TYPE: Record<string, string> = {
  rvmas: "ใบสำคัญรับเงิน",
  rvi: "ใบสำคัญรับเงิน",
  pvmas: "ใบสำคัญจ่าย",
  expense_pv: "ใบสำคัญจ่าย",
  tar_cntar_net: "รับชำระลูกหนี้",
  tar_cash_pool: "รับชำระลูกหนี้",
  pimas: "จ่ายเจ้าหนี้",
  pimas_possible_bundle: "จ่ายเจ้าหนี้",
  bank_cheque: "จ่ายเจ้าหนี้",
  tr_bill: "บิลโอน",
  tr_bundle: "บิลโอน",
  tr_remainder: "บิลโอน",
  "3tr_bill": "บิลโอน",
  internal_transfer: "โอนภายใน",
  interest_income: "ดอกเบี้ยรับ",
  withholding_tax: "หัก ณ ที่จ่าย",
  expense_payroll: "เงินเดือน",
  employee_advance: "เบิกล่วงหน้า",
  vendor_rebate: "ส่วนลดผู้ขาย",
  bank_fee: "ค่าธรรมเนียมธนาคาร",
  sales_adjustment: "ปรับปรุงยอดขาย",
  possible_duplicate: "อาจเป็นแถวซ้ำ",
  marketplace_settlement_pool: "รับชำระตลาดออนไลน์",
};

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_NO_RE = /^\d{3}-\d-\d{5}-\d$/;
const ACCOUNT_DIGITS_RE = /^\d{9,12}$/;

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
  /** Optional party/company name resolved at report time (not stored on the line). */
  matched_party_name?: string | null;
  /** Optional human bill numbers resolved at report time (e.g. expense receipt_number). */
  matched_bill_nos?: string | null;
};

export type EnrichedRow = Record<ReportColumn, string | number | Date | null> & {
  account_no: string;
  bank_name: string;
  source_row_number: number | null;
  /** Internal — used for warning fill + match_status_counts; not a report column. */
  _match_status: string;
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

/** Money cell: blank when null/undefined; keep 0 as 0.00. */
function moneyOrBlank(value: unknown): number | null {
  return toNum(value);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Prefer date-only YYYY-MM-DD as UTC noon to avoid timezone day shifts in Excel.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeMatchStatus(status: string | null | undefined): string {
  let s = (status ?? "").trim();
  if (!s || s === "None" || s === "nan") s = "pending";
  return s;
}

export function cleanedBankDescription(row: StatementLineRow): string {
  const { txnType } = extractRawFields(row.raw_json);
  if (txnType) return txnType;
  if (!looksLikeTime(row.description) && row.description) {
    return String(row.description).trim();
  }
  return "";
}

/** Strip HQ suffix often present on ACCTNAME for cleaner report labels. */
export function normalizePartyDisplayName(name: string): string {
  return name
    .replace(/\s*\(\s*สำนักงานใหญ่\s*\)\s*$/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Best-effort company/customer/vendor extraction from Thai match_notes.
 * Agents often append `— บริษัท …` or put names in parentheses.
 */
export function extractCompanyFromNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  const text = notes.trim();
  if (!text) return "";

  const emDash = text.match(
    /[—–\-]\s*((?:บริษัท|ห้างหุ้นส่วน(?:จำกัด)?|หจก\.?|บจก\.?|บมจ\.?)[^—–\n]+)$/u,
  );
  if (emDash?.[1]) {
    return normalizePartyDisplayName(emDash[1].replace(/\s*[)）]\s*$/u, ""));
  }

  const paren = text.match(
    /[（(]\s*((?:บริษัท|ห้างหุ้นส่วน(?:จำกัด)?|หจก\.?|บจก\.?|บมจ\.?)[^)）]+)[)）]/u,
  );
  if (paren?.[1]) {
    return normalizePartyDisplayName(paren[1]);
  }

  return "";
}

export function splitRefIds(refId: string | null | undefined): string[] {
  if (!refId) return [];
  return refId
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when the token looks like a document/bill number suitable for เลขที่บิล. */
export function isDocumentBillToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (UUID_RE.test(t)) return false;
  if (ISO_DATE_RE.test(t)) return false;
  if (ACCOUNT_NO_RE.test(t)) return false;
  if (ACCOUNT_DIGITS_RE.test(t) && !/[A-Za-zก-๙-]/.test(t)) return false;
  // Marketplace pool keys like "2026-01:Lazada"
  if (/^\d{4}-\d{2}:/.test(t)) return false;
  if (/^TAR-CASH-POOL/i.test(t)) return false;
  return true;
}

export function formatBillNumbers(row: StatementLineRow): string {
  const fromLookup = (row.matched_bill_nos ?? "").trim();
  if (fromLookup) {
    return splitRefIds(fromLookup)
      .filter(isDocumentBillToken)
      .join(", ");
  }

  const fromRef = splitRefIds(row.matched_ref_id)
    .filter(isDocumentBillToken)
    .join(", ");
  return fromRef;
}

/** Parse sales/bill date from tar_cntar_net matched_ref_id (ISO or DD/MM/YYYY). */
export function parseSalesDateFromRefId(
  refId: string | null | undefined,
): Date | null {
  const token = splitRefIds(refId)[0] ?? "";
  if (!token) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(token);
  if (dmy) {
    const d = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1], 12));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function formatDateDdMmYyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** True when the match is SYP daily net (3TAR−3CNTAR), not HQ TAR−CNTAR. */
export function isDailyNet3Tar(row: StatementLineRow): boolean {
  const reason = row.match_reason ?? "";
  const notes = row.match_notes ?? "";
  if (/3TAR/i.test(reason) || /3TAR/i.test(notes) || /3CNTAR/i.test(notes)) {
    return true;
  }
  if (
    /ยอดขายสุทธิ\s*TAR\b/u.test(reason) ||
    /TAR\s*[−\-–]?\s*CNTAR/i.test(notes) ||
    /TAR\s*หัก\s*CNTAR/u.test(notes)
  ) {
    return false;
  }
  const digits = String(row.account_no ?? "").replace(/\D/g, "");
  if (digits.endsWith("0393")) return true;
  if (digits.endsWith("7236")) return false;
  return false;
}

/**
 * Operator label for matched daily net sales (TAR / 3TAR).
 * Uses sales date from matched_ref_id, not the bank txn date.
 */
export function formatDailyNetSalesDescription(
  row: StatementLineRow,
): string | null {
  const refType = (row.matched_ref_type ?? "").trim().toLowerCase();
  if (refType !== "tar_cntar_net") return null;

  const status = normalizeMatchStatus(row.match_status);
  if (status === "pending" || status === "unmatched" || status === "ignored") {
    return null;
  }

  const salesDate = parseSalesDateFromRefId(row.matched_ref_id);
  if (!salesDate) return null;

  const dateLabel = formatDateDdMmYyyy(salesDate);
  if (isDailyNet3Tar(row)) {
    return `ยอดขายสุทธิรายวัน (3TAR หัก 3CNTAR) ของวันที่ ${dateLabel}`;
  }
  return `ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ ${dateLabel}`;
}

/** KTB marketplace settlement account (sheet `KTB_248-0-42113-9`). */
const KTB_MARKETPLACE_ACCOUNT_NO = "248-0-42113-9";

export function isKtbMarketplaceAccount(row: StatementLineRow): boolean {
  const accountNo = String(row.account_no ?? "").trim();
  const bankName = String(row.bank_name ?? "").trim().toUpperCase();
  return accountNo === KTB_MARKETPLACE_ACCOUNT_NO && bankName === "KTB";
}

/**
 * For KTB_248-0-42113-9, map marketplace keywords in bank detail/description
 * to customer labels. Applies regardless of match status (including unmatched/manual).
 */
export function formatMarketplaceCustomerDescription(
  row: StatementLineRow,
): string | null {
  if (!isKtbMarketplaceAccount(row)) return null;

  const { detail } = extractRawFields(row.raw_json);
  const haystack = `${detail}\n${row.description ?? ""}`.toLowerCase();
  if (haystack.includes("shopee")) return "ลูกค้า Shopee";
  if (haystack.includes("lazada")) return "ลูกค้า Lazada";
  if (haystack.includes("tiktok")) return "ลูกค้า TikTok";
  return null;
}

export function shortenMatchReason(reason: string | null | undefined): string {
  if (!reason) return "";
  let text = reason.trim();
  // Drop trailing parenthetical qualifiers: (วันเดียวกัน), (ใกล้วัน), …
  text = text.replace(/\s*[（(][^)）]*[)）]\s*$/u, "").trim();
  // Normalize "ใบสำคัญจ่าย PVMAS" / "ใบสำคัญจ่าย PV" → "ใบสำคัญจ่าย"
  text = text.replace(/^ใบสำคัญจ่าย(?:\s+PVMAS|\s+PV)?\b/u, "ใบสำคัญจ่าย");
  text = text.replace(/^ใบสำคัญรับเงิน(?:ออนไลน์\s+RVI|\s+RVI)?\b/u, "ใบสำคัญรับเงิน");
  return text.trim();
}

export function formatReportRemark(row: StatementLineRow): string {
  const status = normalizeMatchStatus(row.match_status);
  if (status === "pending" || status === "unmatched") {
    return UNMATCHED_NOTE;
  }

  const refType = (row.matched_ref_type ?? "").trim().toLowerCase();
  if (refType && REMARK_BY_REF_TYPE[refType]) {
    return REMARK_BY_REF_TYPE[refType];
  }

  const shortened = shortenMatchReason(row.match_reason);
  if (shortened) return shortened;

  if (status === "review") return "ต้องตรวจ";
  if (!refType && !row.matched_ref_id) return UNMATCHED_NOTE;
  return status;
}

export function resolveDescriptionColumn(row: StatementLineRow): string {
  const marketplace = formatMarketplaceCustomerDescription(row);
  if (marketplace) return marketplace;

  const dailyNet = formatDailyNetSalesDescription(row);
  if (dailyNet) return dailyNet;

  const fromLookup = normalizePartyDisplayName(
    (row.matched_party_name ?? "").trim(),
  );
  if (fromLookup) return fromLookup;

  const fromNotes = extractCompanyFromNotes(row.match_notes);
  if (fromNotes) return fromNotes;

  return cleanedBankDescription(row);
}

/** @deprecated Kept for callers/tests that still import the old rich reason builder. */
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

export function enrichStatementRows(rows: StatementLineRow[]): EnrichedRow[] {
  return rows.map((row) => {
    const status = normalizeMatchStatus(row.match_status);
    const debit = moneyOrBlank(row.debit);
    const credit = moneyOrBlank(row.credit);

    return {
      account_no: String(row.account_no ?? "").trim() || "UNKNOWN",
      bank_name: String(row.bank_name ?? "").trim() || "BANK",
      source_row_number: row.source_row_number,
      _match_status: status,
      "#": 0,
      วันที่: parseDate(row.txn_date),
      "รายการ / ชื่อบริษัท": resolveDescriptionColumn(row),
      ประเภท: formatReportRemark(row),
      เลขที่บิล: formatBillNumbers(row),
      ถอนเงิน: debit,
      ฝากเงิน: credit,
      ยอดคงเหลือ: moneyOrBlank(row.balance_after),
      หมายเหตุ: "",
    };
  });
}

export function sheetNameForAccount(bankName: string, accountNo: string): string {
  const name = `${bankName}_${accountNo}`.replace(/[:\\/?*[\]]/g, "_");
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
      r["#"] = i + 1;
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
    const s = String(row._match_status || "pending");
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

