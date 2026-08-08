import type { BiReportNavGroup, BiReportNavItem } from "./sales-types";

/** Grouped BI sidebar: ยอดขาย · สินค้า · การเงิน */
export const BI_REPORT_GROUPS: BiReportNavGroup[] = [
  {
    id: "sales",
    label: "ยอดขาย",
    reports: [
      {
        id: "sales",
        href: "/bi/sales",
        label: "ภาพรวมยอดขาย",
        available: true,
      },
      {
        id: "sales-compare",
        href: "/bi/sales-compare",
        label: "เปรียบเทียบยอดขาย",
        available: true,
      },
      {
        id: "customers",
        href: "/bi/customers",
        label: "อันดับลูกค้า",
        available: true,
      },
      {
        id: "products",
        href: "/bi/products",
        label: "อันดับสินค้า",
        available: true,
      },
    ],
  },
  {
    id: "products",
    label: "สินค้า",
    reports: [
      {
        id: "product-movement",
        href: "/bi/product-movement",
        label: "การเคลื่อนไหวสินค้า",
        available: true,
      },
    ],
  },
  {
    id: "finance",
    label: "การเงิน",
    reports: [
      {
        id: "income",
        href: "/bi/income",
        label: "กำไรขาดทุน (ทั้งกิจการ)",
        available: true,
      },
      {
        id: "income-statement",
        href: "/bi/income-statement",
        label: "กำไรขาดทุน (เฉพาะส่งบัญชี)",
        available: true,
      },
      {
        id: "cash-flow",
        href: "/bi/cash-flow",
        label: "กระแสเงินสด",
        available: true,
      },
      {
        id: "vat",
        href: "/bi/vat",
        label: "ภาษีขาย / ภาษีซื้อ",
        available: true,
      },
      {
        id: "expenses",
        href: "/bi/expenses",
        label: "ภาพรวมค่าใช้จ่าย",
        available: true,
      },
    ],
  },
];

/** Flat list (permissions, active-route lookup). */
export const BI_REPORTS: BiReportNavItem[] = BI_REPORT_GROUPS.flatMap(
  (group) => group.reports
);
