import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  Handshake,
  ImageUp,
  Images,
  Link2,
  MessageCircleWarning,
  Wallet,
  Banknote,
} from "lucide-react";

export type HomeMenuKey =
  | "reminder"
  | "expense"
  | "po"
  | "stockAudit"
  | "productImageKpi"
  | "bankStatement"
  | "tigerPay"
  | "party"
  | "relatedProducts"
  | "productImages"
  | "faq"
  | "bi";

export type HomeMenuItem = {
  key: HomeMenuKey;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  iconSurfaceClassName: string;
};

export type HomeMenuGroup = {
  title: string;
  items: HomeMenuItem[];
};

export const HOME_MENU_ITEMS = {
  reminder: {
    key: "reminder",
    href: "/reminder",
    label: "เตือนโอน",
    description: "ติดตามรายการและกำหนดการโอนเงิน",
    icon: MessageCircleWarning,
    iconClassName: "text-amber-600",
    iconSurfaceClassName: "bg-amber-50 ring-amber-100",
  },
  expense: {
    key: "expense",
    href: "/expense",
    label: "ค่าใช้จ่าย",
    description: "บันทึกและตรวจสอบค่าใช้จ่าย",
    icon: Banknote,
    iconClassName: "text-emerald-600",
    iconSurfaceClassName: "bg-emerald-50 ring-emerald-100",
  },
  po: {
    key: "po",
    href: "/po",
    label: "ใบสั่งซื้อ (PO)",
    description: "ตรวจสอบสถานะใบสั่งซื้อ",
    icon: ClipboardList,
    iconClassName: "text-violet-600",
    iconSurfaceClassName: "bg-violet-50 ring-violet-100",
  },
  stockAudit: {
    key: "stockAudit",
    href: "/stock-audit",
    label: "KPI ตรวจนับ",
    description: "งานนับสต็อกจาก LINE และความสดของรหัส",
    icon: Boxes,
    iconClassName: "text-sky-600",
    iconSurfaceClassName: "bg-sky-50 ring-sky-100",
  },
  productImageKpi: {
    key: "productImageKpi",
    href: "/product-images/kpi",
    label: "KPI รูปสินค้า",
    description: "งานอัปโหลด แทนที่ ลบรูปจาก LINE",
    icon: ImageUp,
    iconClassName: "text-rose-600",
    iconSurfaceClassName: "bg-rose-50 ring-rose-100",
  },
  bankStatement: {
    key: "bankStatement",
    href: "/bank-statement-sync",
    label: "Bank Statement",
    description: "นำเข้าและจับคู่รายการเดินบัญชี",
    icon: ArrowRightLeft,
    iconClassName: "text-blue-600",
    iconSurfaceClassName: "bg-blue-50 ring-blue-100",
  },
  tigerPay: {
    key: "tigerPay",
    href: "/tiger-pay",
    label: "Tiger Pay",
    description: "ตรวจสอบธุรกรรมและการรับชำระ",
    icon: Wallet,
    iconClassName: "text-orange-600",
    iconSurfaceClassName: "bg-orange-50 ring-orange-100",
  },
  party: {
    key: "party",
    href: "/party",
    label: "รายชื่อคู่ค้า",
    description: "ดูแลข้อมูลลูกค้าและผู้ขาย",
    icon: Handshake,
    iconClassName: "text-indigo-600",
    iconSurfaceClassName: "bg-indigo-50 ring-indigo-100",
  },
  relatedProducts: {
    key: "relatedProducts",
    href: "/product-related",
    label: "สินค้าที่ซื้อด้วยกัน",
    description: "ค้นหาความสัมพันธ์ระหว่างสินค้า",
    icon: Link2,
    iconClassName: "text-fuchsia-600",
    iconSurfaceClassName: "bg-fuchsia-50 ring-fuchsia-100",
  },
  productImages: {
    key: "productImages",
    href: "/product-images",
    label: "จัดการรูปสินค้า",
    description: "แก้ไขช่องรูปสินค้าใน Storage",
    icon: Images,
    iconClassName: "text-pink-600",
    iconSurfaceClassName: "bg-pink-50 ring-pink-100",
  },
  faq: {
    key: "faq",
    href: "/kb",
    label: "จัดการ FAQ",
    description: "ดูแลคลังความรู้สำหรับทีม",
    icon: BookOpen,
    iconClassName: "text-teal-600",
    iconSurfaceClassName: "bg-teal-50 ring-teal-100",
  },
  bi: {
    key: "bi",
    href: "/bi",
    label: "รายงาน BI",
    description: "ดูภาพรวมและวิเคราะห์ข้อมูลธุรกิจ",
    icon: BarChart3,
    iconClassName: "text-blue-600",
    iconSurfaceClassName: "bg-blue-50 ring-blue-100",
  },
} satisfies Record<HomeMenuKey, HomeMenuItem>;

export const HOME_MENU_KEYS = Object.keys(HOME_MENU_ITEMS) as HomeMenuKey[];

export const DEFAULT_FAVORITE_KEYS: HomeMenuKey[] = [
  "reminder",
  "expense",
  "po",
  "bi",
];

/**
 * Sidebar / catalog groups. Section titles are kept for catalog identity but
 * the Home sidebar renders groups with dividers only (no visible titles).
 *
 * Order mirrors the Home sidebar:
 * 1. daily ops (reminder / PO) — expense is rendered separately
 * 2. ops KPI reports (stock check / product images)
 * 3. finance
 * 4. master data / products
 * 5. reports / knowledge
 */
export const HOME_MENU_GROUPS: HomeMenuGroup[] = [
  {
    title: "งานประจำวัน",
    items: [HOME_MENU_ITEMS.reminder, HOME_MENU_ITEMS.po],
  },
  {
    title: "KPI งาน",
    items: [HOME_MENU_ITEMS.stockAudit, HOME_MENU_ITEMS.productImageKpi],
  },
  {
    title: "การเงินและรับชำระ",
    items: [HOME_MENU_ITEMS.bankStatement, HOME_MENU_ITEMS.tigerPay],
  },
  {
    title: "ข้อมูลและสินค้า",
    items: [
      HOME_MENU_ITEMS.party,
      HOME_MENU_ITEMS.relatedProducts,
      HOME_MENU_ITEMS.productImages,
    ],
  },
  {
    title: "รายงานและความรู้",
    items: [HOME_MENU_ITEMS.bi, HOME_MENU_ITEMS.faq],
  },
];

export function isHomeMenuKey(value: string): value is HomeMenuKey {
  return value in HOME_MENU_ITEMS;
}

export function resolveFavoriteItems(keys: HomeMenuKey[]): HomeMenuItem[] {
  return keys
    .filter((key, index, all) => all.indexOf(key) === index)
    .map((key) => HOME_MENU_ITEMS[key])
    .filter(Boolean);
}
