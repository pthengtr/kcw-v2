import {
  ADMIN_RBAC_PAGE,
  BANK_PAGE_KEYS,
  BI_PAGE_KEYS,
  PO_PAGE_KEYS,
  STOCK_AUDIT_PAGE_KEY,
} from "./rbac-pages";

export function canAccessPage(pageKeys: string[], pageKey: string): boolean {
  return pageKeys.includes("*") || pageKeys.includes(pageKey);
}

export function canAccessAnyBi(pageKeys: string[]): boolean {
  return (
    pageKeys.includes("*") ||
    Object.values(BI_PAGE_KEYS).some((key) => pageKeys.includes(key))
  );
}

export function canAccessAdminRbac(pageKeys: string[]): boolean {
  return canAccessPage(pageKeys, ADMIN_RBAC_PAGE);
}

export function canAccessTigerPay(pageKeys: string[]): boolean {
  return canAccessPage(pageKeys, BANK_PAGE_KEYS.tigerPay);
}

export function canAccessStatementSync(pageKeys: string[]): boolean {
  return canAccessPage(pageKeys, BANK_PAGE_KEYS.statementSync);
}

export function canAccessPoStatus(pageKeys: string[]): boolean {
  return canAccessPage(pageKeys, PO_PAGE_KEYS.status);
}

export function canAccessStockAudit(pageKeys: string[]): boolean {
  return canAccessPage(pageKeys, STOCK_AUDIT_PAGE_KEY);
}

