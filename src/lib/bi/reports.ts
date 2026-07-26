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
    id: "customers",
    href: "/bi/customers",
    label: "อันดับลูกค้า",
    description: "จัดอันดับยอดซื้อตามลูกค้า",
    available: false,
  },
  {
    id: "products",
    href: "/bi/products",
    label: "อันดับสินค้า",
    description: "จัดอันดับยอดขายตามสินค้า",
    available: true,
  },
];
