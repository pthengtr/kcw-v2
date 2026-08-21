export type RbacPageKey = string;

export const ADMIN_RBAC_PAGE: RbacPageKey = "admin_rbac";
export const ROLE_NORMAL = "normal";
export const ROLE_ADMIN = "admin";

export const BI_PAGE_KEYS = {
  income: "bi_income",
  incomeStatement: "bi_income_statement",
  sales: "bi_sales",
  salesCompare: "bi_sales_compare",
  customers: "bi_customers",
  products: "bi_products",
  productMovement: "bi_product_movement",
  expenses: "bi_expenses",
  cashflow: "bi_cashflow",
  vat: "bi_vat",
} as const;

/** Old keys that still exist in kcw_role_page_permissions. */
export const PAGE_KEY_ALIASES: Record<string, string> = {
  bi_product_sales: BI_PAGE_KEYS.sales,
};

export function canonicalizePageKey(pageKey: string): string {
  return PAGE_KEY_ALIASES[pageKey] ?? pageKey;
}

export function canonicalizePageKeys(pageKeys: string[]): string[] {
  return Array.from(new Set(pageKeys.map(canonicalizePageKey)));
}

/** Canonical key plus any stored aliases that should grant it. */
export function pageKeysMatching(canonicalPageKey: string): string[] {
  const aliases = Object.entries(PAGE_KEY_ALIASES)
    .filter(([, target]) => target === canonicalPageKey)
    .map(([alias]) => alias);
  return [canonicalPageKey, ...aliases];
}

export const BANK_PAGE_KEYS = {
  tigerPay: "bank_tiger_pay",
  statementSync: "bank_statement_sync",
} as const;

export const PO_PAGE_KEYS = {
  status: "po_status",
} as const;

/** Stock date-audit operator page (daily pick + mark + status dashboard). */
export const STOCK_AUDIT_PAGE_KEY: RbacPageKey = "stock_audit";

export const RBAC_PROTECTED_PAGE_KEYS: RbacPageKey[] = [
  ADMIN_RBAC_PAGE,
  BI_PAGE_KEYS.income,
  BI_PAGE_KEYS.incomeStatement,
  BI_PAGE_KEYS.sales,
  BI_PAGE_KEYS.salesCompare,
  BI_PAGE_KEYS.customers,
  BI_PAGE_KEYS.products,
  BI_PAGE_KEYS.productMovement,
  BI_PAGE_KEYS.expenses,
  BI_PAGE_KEYS.cashflow,
  BI_PAGE_KEYS.vat,
  BANK_PAGE_KEYS.tigerPay,
  BANK_PAGE_KEYS.statementSync,
  PO_PAGE_KEYS.status,
  STOCK_AUDIT_PAGE_KEY,
];

