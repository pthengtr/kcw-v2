/** Printable full tax invoice / receipt — mirrors kcw-api to_bill.sheet. */

export const TO_BILL_COMPANY = {
  name: "บริษัท เกียรติชัยอะไหล่ยนต์ 2007 จำกัด",
  address: "305 ม.1 ต.ชุมแสง อ.วังจันทร์ จ.ระยอง 21210",
  phone: "038-666-078, 093-399-6490",
  branch: "สำนักงานใหญ่",
  taxId: "0215560000262",
} as const;

export const ROLE_ISSUER = "ผู้ออกเอกสาร";
export const ROLE_APPROVER = "ผู้อนุมัติเอกสาร";

export type ToBillSigner = {
  nick: string;
  fullName: string;
  image: string;
  aliases: string[];
};

export const AON: ToBillSigner = {
  nick: "อ้อน",
  fullName: "มัญชุนันท์ คำลา",
  image: "/to-bill/signatures/aon.jpg",
  aliases: ["อ้อน", "มัญชุนันท์", "คำลา", "aon", "manchunan"],
};

export const MAY: ToBillSigner = {
  nick: "เมย์",
  fullName: "ปิยะนุช นันตาบุตร",
  image: "/to-bill/signatures/may.jpg",
  aliases: ["เมย์", "เมย", "ปิยะนุช", "นันตาบุตร", "may", "piyanuch"],
};

export const CARTOON: ToBillSigner = {
  nick: "การ์ตูน",
  fullName: "จิดาภา กระจาย",
  image: "/to-bill/signatures/cartoon.jpg",
  aliases: ["การ์ตูน", "การตูน", "จิดาภา", "กระจาย", "cartoon", "jidapa"],
};

const ALLOWED = [AON, MAY, CARTOON] as const;

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const PLATFORMS: Record<string, string> = {
  lazada: "LAZADA",
  shopee: "SHOPEE",
  tiktok: "TIKTOK",
};

const SHOP_RE = /^(\S+)\s*\((.+)\)\s*$/;

export type ToBillSheetLine = {
  bcode: string | null;
  detail: string | null;
  qty: number;
  ui: string | null;
  price: number;
  amount: number;
};

export type ToBillSheetData = {
  docno: string;
  status: string;
  tad_billno: string;
  bill_date: string | null;
  issued_at?: string | null;
  issued_by?: string | null;
  customer_name: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
  branch_label: string | null;
  email: string | null;
  online_po: string | null;
  beforetax: number;
  tax: number;
  aftertax: number;
  discount: number;
  void_reason: string | null;
  pay_via?: string | null;
  source_docno?: string | null;
  acctno?: string | null;
  acctname_kss?: string | null;
  lines: ToBillSheetLine[];
};

function tokens(value: string): Set<string> {
  const raw = value || "";
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  const out = new Set<string>();
  if (compact) out.add(compact);
  for (const word of raw.split(/[\s\-_/,.]+/)) {
    const cleaned = word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (cleaned) out.add(cleaned);
  }
  return out;
}

export function matchSigner(actor: string): ToBillSigner | null {
  const found = tokens(actor);
  if (found.size === 0) return null;
  for (const signer of ALLOWED) {
    const aliases = new Set(
      signer.aliases.map((alias) => alias.replace(/\s+/g, "").toLowerCase())
    );
    for (const token of found) {
      if (aliases.has(token)) return signer;
    }
  }
  return null;
}

/** Who fills issuer / approver. การ์ตูน signs both when she issued. */
export function sheetSigners(issuedBy = ""): [ToBillSigner, ToBillSigner] {
  if (matchSigner(issuedBy) === CARTOON) return [CARTOON, CARTOON];
  return [AON, MAY];
}

export function signerDisplayName(signer: ToBillSigner): string {
  return signer.fullName;
}

export function isReceiptDoc(docno: string | null | undefined, docKind?: string | null): boolean {
  if (docKind === "rvo") return true;
  return (docno || "").trim().toUpperCase().startsWith("RVO");
}

export function payViaLabel(value: string | null | undefined): string | null {
  if (value === "platform") return "ชำระผ่านแพลตฟอร์ม";
  if (value === "cod") return "เก็บเงินปลายทาง (COD)";
  return null;
}

export function shopLabel(acctname: string | null | undefined, acctno: string | null | undefined): string {
  let raw = (acctname || "").trim().replace(/\s+/g, " ");
  raw = raw.replace(/^คุณลูกค้าทั่วไป\s+/i, "");
  const match = SHOP_RE.exec(raw);
  if (!match) return "";
  const platform = PLATFORMS[match[1].toLowerCase()];
  const shop = match[2].replace(/\s+/g, " ").trim();
  if (!platform || !shop) return "";
  const code = (acctno || "").trim();
  const body = `${platform} | ${shop}`;
  return code ? `${body} (${code})` : body;
}

function parseDay(value: string | null | undefined): Date | null {
  const text = String(value || "").trim();
  if (text.length < 10) return null;
  const day = new Date(`${text.slice(0, 10)}T00:00:00+07:00`);
  return Number.isNaN(day.getTime()) ? null : day;
}

export function thaiLongDate(value: string | null | undefined): string {
  const day = parseDay(value);
  if (!day) return "—";
  return `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear() + 543}`;
}

export function thaiSlashDate(value: string | null | undefined): string {
  const day = parseDay(value);
  if (!day) return "—";
  const dd = String(day.getDate()).padStart(2, "0");
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${day.getFullYear() + 543}`;
}

export function formatSheetMoney(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSheetQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const [whole, frac = ""] = value.toFixed(4).split(".");
  const trimmed = frac.replace(/0+$/, "");
  const withCommas = Number(whole).toLocaleString("en-US");
  return trimmed ? `${withCommas}.${trimmed}` : withCommas || "0";
}
