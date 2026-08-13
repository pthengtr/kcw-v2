import {
  canAccessAnyBi,
  canAccessAdminRbac,
  canAccessPoStatus,
  canAccessStatementSync,
  canAccessStockAudit,
  canAccessTigerPay,
} from "@/lib/auth/client-permissions";
import { HOME_MENU_ITEMS, type HomeMenuItem, type HomeMenuKey } from "./menu";

export function canAccessHomeMenuItem(
  key: HomeMenuKey,
  pageKeys: string[]
): boolean {
  switch (key) {
    case "po":
      return canAccessPoStatus(pageKeys);
    case "stockAudit":
      return canAccessStockAudit(pageKeys);
    case "bankStatement":
      return canAccessStatementSync(pageKeys);
    case "tigerPay":
      return canAccessTigerPay(pageKeys);
    case "bi":
      return canAccessAnyBi(pageKeys);
    default:
      return true;
  }
}

export function filterHomeMenuItem(
  item: HomeMenuItem,
  pageKeys: string[] | null
): boolean {
  if (pageKeys == null) return false;
  return canAccessHomeMenuItem(item.key, pageKeys);
}

export function matchesMenuSearch(
  item: Pick<HomeMenuItem, "label" | "description">,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    item.label.toLowerCase().includes(normalized) ||
    item.description.toLowerCase().includes(normalized)
  );
}

/** True when pathname matches href, preferring longer sibling menu hrefs. */
export function isHomeMenuPathActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/home" || !pathname.startsWith(`${href}/`)) return false;

  const menuHrefs = Object.values(HOME_MENU_ITEMS).map((item) => item.href);
  const hasLongerMenuMatch = menuHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );
  return !hasLongerMenuMatch;
}

export { canAccessAdminRbac };
