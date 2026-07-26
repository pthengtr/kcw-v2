import type { BiReportNavItem } from "./sales-types";

export const BI_REPORTS: BiReportNavItem[] = [
  {
    id: "sales",
    href: "/bi/sales",
    label: "ภาพรวมยอดขาย",
    description: "VAT / สาขา / ออนไลน์ · รายวัน–YTD",
    available: true,
  },
  {
    id: "sales-compare",
    href: "/bi/sales-compare",
    label: "เปรียบเทียบยอดขาย",
    description: "เทียบปี / เดือน · ตาราง แท่ง เส้น",
    available: true,
  },
  {
    id: "customers",
    href: "/bi/customers",
    label: "อันดับลูกค้า",
    description: "จัดอันดับยอดซื้อตามลูกค้า",
    available: true,
  },
  {
    id: "products",
    href: "/bi/products",
    label: "อันดับสินค้า",
    description: "จัดอันดับยอดขายตามสินค้า",
    available: true,
  },
  {
    id: "product-movement",
    href: "/bi/product-movement",
    label: "การเคลื่อนไหวสินค้า",
    description: "ขายออกบ่อย / สต็อกค้างตามอายุซื้อ",
    available: true,
  },
  {
    id: "expenses",
    href: "/bi/expenses",
    label: "ภาพรวมค่าใช้จ่าย",
    description: "บริษัท + ทั่วไป · รายเดือน–YTD",
    available: true,
  },
  {
    id: "income",
    href: "/bi/income",
    label: "กำไรขั้นต้น / สุทธิ",
    description: "ยอดขาย − ต้นทุน − ค่าใช้จ่าย (ประมาณการ)",
    available: true,
  },
];
