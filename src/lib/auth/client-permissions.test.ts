import { describe, expect, it } from "vitest";

import {
  canAccessAdminRbac,
  canAccessAnyBi,
  canAccessPage,
} from "./client-permissions";
import { ADMIN_RBAC_PAGE, BI_PAGE_KEYS } from "./rbac-pages";

describe("client permission helpers", () => {
  it("treats * as full access", () => {
    expect(canAccessPage(["*"], BI_PAGE_KEYS.income)).toBe(true);
    expect(canAccessAnyBi(["*"])).toBe(true);
    expect(canAccessAdminRbac(["*"])).toBe(true);
  });

  it("checks specific page keys", () => {
    expect(canAccessPage([BI_PAGE_KEYS.sales], BI_PAGE_KEYS.sales)).toBe(true);
    expect(canAccessPage([BI_PAGE_KEYS.sales], BI_PAGE_KEYS.income)).toBe(
      false
    );
    expect(canAccessAnyBi([BI_PAGE_KEYS.customers])).toBe(true);
    expect(canAccessAnyBi([])).toBe(false);
    expect(canAccessAdminRbac([ADMIN_RBAC_PAGE])).toBe(true);
  });
});
