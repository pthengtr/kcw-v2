import * as XLSX from "xlsx";

export const ONLINE_STATEMENT_FORMATS = ["lazada", "shopee", "tiktok"] as const;
export type OnlineStatementFormat = (typeof ONLINE_STATEMENT_FORMATS)[number];

export const ONLINE_STATEMENT_SHOPS = {
  lazada: ["IAPL", "LAZ1", "LAZ2", "LICE", "LPNT"],
  shopee: ["SP", "SPNT", "SICE", "IAPS"],
  tiktok: ["ICE"],
} as const;

export const ONLINE_STATEMENT_MAX_BYTES = 15 * 1024 * 1024;

const LAZADA_HEADERS = [
  "Amount",
  "Statement",
  "Paid Status",
  "Order No.",
  "Fee Name",
  "Transaction Type",
] as const;

export function isOnlineStatementFormat(value: string): value is OnlineStatementFormat {
  return (ONLINE_STATEMENT_FORMATS as readonly string[]).includes(value);
}

export function shopsForFormat(format: OnlineStatementFormat): readonly string[] {
  return ONLINE_STATEMENT_SHOPS[format];
}

export function shopsForPlatform(platform: string): readonly string[] {
  if (platform === "lazada" || platform === "shopee" || platform === "tiktok") {
    return ONLINE_STATEMENT_SHOPS[platform];
  }
  return [
    ...ONLINE_STATEMENT_SHOPS.lazada,
    ...ONLINE_STATEMENT_SHOPS.shopee,
    ...ONLINE_STATEMENT_SHOPS.tiktok,
  ];
}

export function isShopForFormat(format: OnlineStatementFormat, shop: string): boolean {
  return (shopsForFormat(format) as readonly string[]).includes(shop);
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function sheetGrid(wb: XLSX.WorkBook, names: string[]): unknown[][] {
  const found = wb.SheetNames.find((name) =>
    names.some((wanted) => name === wanted || name.includes(wanted))
  );
  if (!found) return [];
  const sheet = wb.Sheets[found];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][];
}

function looksLikeDate(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value === "number" && value > 20000 && value < 80000) return true;
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw);
}

function validateLazada(wb: XLSX.WorkBook): { ok: true; rowCount: number } | { ok: false; error: string } {
  const rows = sheetGrid(wb, ["Transaction Overview"]);
  if (rows.length === 0) {
    return { ok: false, error: "ไม่พบชีท Transaction Overview ของ Lazada" };
  }
  const header = rows[0].map(text);
  const missing = LAZADA_HEADERS.filter((name) => !header.includes(name));
  if (missing.length) {
    return { ok: false, error: `ไฟล์ Lazada ขาดคอลัมน์ ${missing.join(", ")}` };
  }
  const statementAt = header.indexOf("Statement");
  const data = rows.slice(1).filter((row) => text(row[statementAt]) !== "");
  if (data.length === 0) {
    return { ok: false, error: "ไฟล์ Lazada ไม่มีแถว Statement" };
  }
  return { ok: true, rowCount: data.length };
}

function validateShopee(wb: XLSX.WorkBook): { ok: true; rowCount: number } | { ok: false; error: string } {
  const rows = sheetGrid(wb, ["Transaction Report"]);
  const headerAt = rows.findIndex(
    (row) => text(row[0]) === "วันที่" && text(row[1]) === "ประเภทการทำธุรกรรม"
  );
  if (headerAt < 0) {
    return { ok: false, error: "ไม่พบหัวตาราง Shopee (วันที่, ประเภทการทำธุรกรรม)" };
  }
  const data = rows.slice(headerAt + 1).filter((row) => looksLikeDate(row[0]));
  if (data.length === 0) {
    return { ok: false, error: "ไฟล์ Shopee ไม่มีแถววันที่" };
  }
  return { ok: true, rowCount: data.length };
}

function validateTiktok(wb: XLSX.WorkBook): { ok: true; rowCount: number } | { ok: false; error: string } {
  const orders = sheetGrid(wb, ["รายละเอียดคำสั่งซื้อ", "Order details"]);
  const withdrawals = sheetGrid(wb, ["บันทึกการถอน", "Withdrawals"]);
  const orderHeader = (orders[0] ?? []).map(text);
  const withdrawHeader = (withdrawals[0] ?? []).map(text);
  if (!orderHeader.includes("หมายเลขคำสั่งซื้อ/การปรับ")) {
    return { ok: false, error: "ไม่พบชีทรายละเอียดคำสั่งซื้อของ TikTok" };
  }
  if (!withdrawHeader.includes("ประเภทธุรกรรม")) {
    return { ok: false, error: "ไม่พบชีทบันทึกการถอนของ TikTok" };
  }
  const orderAt = orderHeader.indexOf("หมายเลขคำสั่งซื้อ/การปรับ");
  const typeAt = withdrawHeader.indexOf("ประเภทธุรกรรม");
  const orderCount = orders.slice(1).filter((row) => text(row[orderAt]) !== "").length;
  const withdrawalCount = withdrawals
    .slice(1)
    .filter((row) => text(row[typeAt]).toLowerCase() === "withdrawal").length;
  if (orderCount + withdrawalCount === 0) {
    return { ok: false, error: "ไฟล์ TikTok ไม่มีคำสั่งซื้อหรือรายการถอน" };
  }
  return { ok: true, rowCount: orderCount + withdrawalCount };
}

export function validateOnlineWorkbook(
  bytes: Uint8Array | ArrayBuffer,
  format: OnlineStatementFormat
): { ok: true; rowCount: number } | { ok: false; error: string } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: "array" });
  } catch {
    return { ok: false, error: "เปิดไฟล์ Excel ไม่ได้" };
  }
  if (format === "lazada") return validateLazada(wb);
  if (format === "shopee") return validateShopee(wb);
  return validateTiktok(wb);
}
