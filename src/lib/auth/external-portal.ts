import { ROLE_ADMIN, ROLE_EXTERNAL } from "./rbac-pages";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isExternalPortalUser(roleKeys: string[]): boolean {
  return roleKeys.includes(ROLE_EXTERNAL) && !roleKeys.includes(ROLE_ADMIN);
}

function isStatementReadApi(pathname: string): boolean {
  return (
    pathname === "/api/bank/statement-lines" ||
    pathname.startsWith("/api/bank/statement-lines/") ||
    pathname === "/api/bank/import-files" ||
    pathname.startsWith("/api/bank/import-files/") ||
    pathname === "/api/online-statements" ||
    pathname.startsWith("/api/online-statements/") ||
    pathname === "/api/sales-bills/detail"
  );
}

export type ExternalAccess = "allow" | "deny" | "redirect";

/** Where an external (non-admin) user may go. Writes on statement APIs are denied. */
export function externalPortalAccess(
  pathname: string,
  method: string
): ExternalAccess {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    return "allow";
  }

  const upper = method.toUpperCase();

  if (pathname === "/api/auth/me/permissions") {
    return SAFE_METHODS.has(upper) ? "allow" : "deny";
  }

  if (isStatementReadApi(pathname)) {
    return SAFE_METHODS.has(upper) ? "allow" : "deny";
  }

  if (pathname.startsWith("/api") || !SAFE_METHODS.has(upper)) {
    return "deny";
  }

  return "redirect";
}

function safePortalNext(nextPath: string | null): string | null {
  if (!nextPath) return null;
  if (nextPath !== "/portal" && !nextPath.startsWith("/portal/")) return null;
  if (
    nextPath.includes("\\") ||
    nextPath.includes("..") ||
    nextPath.includes("//")
  ) {
    return null;
  }
  return nextPath;
}

/** External users land on the portal. Internal users always land on /home. */
export function loginDestination(
  roleKeys: string[],
  nextPath: string | null
): string {
  if (!isExternalPortalUser(roleKeys)) return "/home";
  return safePortalNext(nextPath) ?? "/portal";
}
