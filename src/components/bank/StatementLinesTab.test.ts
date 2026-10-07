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
  it("lets view keys read lines and keeps match edits on the write key", () => {
    const list = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/bank/statement-lines/route.ts"),
      "utf8",
    );
    const detail = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/bank/statement-lines/[id]/route.ts",
      ),
      "utf8",
    );
    expect(list).toContain("BANK_STATEMENT_READ_PAGE_KEYS");
    expect(detail).toContain("BANK_STATEMENT_READ_PAGE_KEYS");
    expect(detail).toContain("BANK_PAGE_KEYS.statementSync");
  });
});
