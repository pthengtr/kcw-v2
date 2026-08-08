import { describe, expect, it } from "vitest";

import { BI_REPORT_GROUPS, BI_REPORTS } from "./reports";

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
});
