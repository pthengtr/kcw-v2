import { describe, expect, it } from "vitest";

import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { BI_REPORT_GROUPS, BI_REPORTS, firstAllowedBiReport } from "./reports";

describe("BI_REPORT_GROUPS", () => {
  it("has three top-level sections in the requested order", () => {
    expect(BI_REPORT_GROUPS.map((g) => g.label)).toEqual([
      "ยอดขาย",
      "สินค้า",
      "การเงิน",
    ]);
  });

  it("lists finance reports with short labels", () => {
    const finance = BI_REPORT_GROUPS.find((g) => g.id === "finance");
    expect(finance?.reports.map((r) => r.label)).toEqual([
      "กำไรขาดทุน (ทั้งกิจการ)",
      "กำไรขาดทุน (เฉพาะส่งบัญชี)",
      "กระแสเงินสด",
      "ภาษีขาย / ภาษีซื้อ",
      "ภาพรวมค่าใช้จ่าย",
    ]);
  });

  it("keeps flat BI_REPORTS in sync with groups", () => {
    expect(BI_REPORTS.map((r) => r.id)).toEqual(
      BI_REPORT_GROUPS.flatMap((g) => g.reports.map((r) => r.id))
    );
  });

  it("lists product-sales under สินค้า", () => {
    const products = BI_REPORT_GROUPS.find((g) => g.id === "products");
    expect(products?.reports.map((r) => r.id)).toEqual([
      "product-sales",
      "product-movement",
    ]);
  });

  it("gates every report with a known BI page key", () => {
    const known = new Set<string>(Object.values(BI_PAGE_KEYS));
    for (const report of BI_REPORTS) {
      expect(known.has(report.pageKey)).toBe(true);
    }
  });

  it("prefers income when granted, else the first allowed sidebar report", () => {
    expect(firstAllowedBiReport(["*"])?.href).toBe("/bi/income");
    expect(firstAllowedBiReport([BI_PAGE_KEYS.income])?.href).toBe(
      "/bi/income"
    );
    expect(firstAllowedBiReport([BI_PAGE_KEYS.customers])?.href).toBe(
      "/bi/customers"
    );
    expect(
      firstAllowedBiReport([BI_PAGE_KEYS.expenses, BI_PAGE_KEYS.sales])?.href
    ).toBe("/bi/sales");
    expect(firstAllowedBiReport([BI_PAGE_KEYS.productSales])?.href).toBe(
      "/bi/product-sales"
    );
    expect(firstAllowedBiReport([])).toBeNull();
  });
});
