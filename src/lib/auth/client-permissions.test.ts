import { describe, expect, it } from "vitest";

import {
  canAccessAdminRbac,
  canAccessAnyBi,
  canAccessPage,
} from "./client-permissions";
import {
  ADMIN_RBAC_PAGE,
  BI_PAGE_KEYS,
  canonicalizePageKeys,
  pageKeysMatching,
} from "./rbac-pages";

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

describe("legacy page-key aliases", () => {
  it("maps bi_product_sales to bi_sales", () => {
    expect(canonicalizePageKeys(["bi_product_sales", "bi_customers"])).toEqual([
      BI_PAGE_KEYS.sales,
      BI_PAGE_KEYS.customers,
    ]);
    expect(pageKeysMatching(BI_PAGE_KEYS.sales)).toEqual([
      BI_PAGE_KEYS.sales,
      "bi_product_sales",
    ]);
  });
});
