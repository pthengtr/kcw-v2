import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("StatementLinesTab columns", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/components/bank/StatementLinesTab.tsx"),
    "utf8",
  );

  it("does not show source sheet or source row columns", () => {
    expect(src).not.toContain("ชีทต้นทาง");
    expect(src).not.toContain("แถวต้นทาง");
    expect(src).not.toContain("source_sheet_name");
    expect(src).not.toContain("source_row_number");
  });

  it("renders รายละเอียด from the report item label", () => {
    expect(src).toContain('header: "รายละเอียด"');
    expect(src).toContain("itemLabel(");
    expect(src).toContain("item_label");
  });
});

describe("statement-lines API routes", () => {
  it("imports BANK_PAGE_KEYS on list and detail routes", () => {
    for (const rel of [
      "src/app/api/bank/statement-lines/route.ts",
      "src/app/api/bank/statement-lines/[id]/route.ts",
    ]) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src).toContain(
        'import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages"',
      );
    }
  });
});
