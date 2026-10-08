import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessPage } from "@/lib/auth/client-permissions";
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
        pageKey: BI_PAGE_KEYS.sales,
        available: true,
      },
      {
        id: "sales-compare",
        href: "/bi/sales-compare",
        label: "เปรียบเทียบยอดขาย",
        pageKey: BI_PAGE_KEYS.salesCompare,
        available: true,
      },
      {
        id: "customers",
        href: "/bi/customers",
        label: "อันดับลูกค้า",
        pageKey: BI_PAGE_KEYS.customers,
        available: true,
      },
      {
        id: "products",
        href: "/bi/products",
        label: "อันดับสินค้า",
        pageKey: BI_PAGE_KEYS.products,
        available: true,
      },
    ],
  },
  {
    id: "products",
    label: "สินค้า",
    reports: [
      {
        id: "product-sales",
        href: "/bi/product-sales",
        label: "ยอดขายตามสินค้า",
        pageKey: BI_PAGE_KEYS.productSales,
        available: true,
      },
      {
        id: "product-movement",
        href: "/bi/product-movement",
        label: "การเคลื่อนไหวสินค้า",
        pageKey: BI_PAGE_KEYS.productMovement,
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
        pageKey: BI_PAGE_KEYS.income,
        available: true,
      },
      {
        id: "income-statement",
        href: "/bi/income-statement",
        label: "กำไรขาดทุน (เฉพาะส่งบัญชี)",
        pageKey: BI_PAGE_KEYS.incomeStatement,
        available: true,
      },
      {
        id: "cash-flow",
        href: "/bi/cash-flow",
        label: "กระแสเงินสด",
        pageKey: BI_PAGE_KEYS.cashflow,
        available: true,
      },
      {
        id: "vat",
        href: "/bi/vat",
        label: "ภาษีขาย / ภาษีซื้อ",
        pageKey: BI_PAGE_KEYS.vat,
        available: true,
      },
      {
        id: "expenses",
        href: "/bi/expenses",
        label: "ภาพรวมค่าใช้จ่าย",
        pageKey: BI_PAGE_KEYS.expenses,
        available: true,
      },
    ],
  },
];

/** Flat list (permissions, active-route lookup). */
export const BI_REPORTS: BiReportNavItem[] = BI_REPORT_GROUPS.flatMap(
  (group) => group.reports
);

/** Prefer income when granted; otherwise the first sidebar report the user can open. */
export function firstAllowedBiReport(
  pageKeys: string[]
): BiReportNavItem | null {
  const income = BI_REPORTS.find((r) => r.id === "income");
  if (income && canAccessPage(pageKeys, income.pageKey)) {
    return income;
  }
  return (
    BI_REPORTS.find(
      (r) => r.available && canAccessPage(pageKeys, r.pageKey)
    ) ?? null
  );
}
