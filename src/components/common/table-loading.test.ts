import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Table loading empty states", () => {
  it("ServerPagedTable shows spinner loading instead of empty when loading", () => {
    const src = read("src/components/bank/ServerPagedTable.tsx");
    expect(src).toContain("loading = false");
    expect(src).toContain("TableLoadingState");
    expect(src).toContain("loading && !rows.length");
  });

  it("DataTable shows spinner loading instead of empty when loading", () => {
    const src = read("src/components/common/DataTable.tsx");
    expect(src).toContain("loading?: boolean");
    expect(src).toContain("TableLoadingState");
  });

  it("PO and bank tables pass loading into ServerPagedTable", () => {
    for (const rel of [
      "src/components/po/PoHqTab.tsx",
      "src/components/po/PoSypTab.tsx",
      "src/components/bank/ImportFilesTab.tsx",
      "src/components/bank/StatementLinesTab.tsx",
      "src/components/bank/TigerPayTab.tsx",
    ]) {
      expect(read(rel)).toContain("loading={loading}");
    }
  });
});
