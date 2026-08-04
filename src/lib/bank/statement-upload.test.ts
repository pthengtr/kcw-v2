import { describe, expect, it, vi } from "vitest";

import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessStatementSync } from "@/lib/auth/client-permissions";
import {
  BANK_STATEMENT_IMPORT_FN,
  BANK_STATEMENT_MAX_BYTES,
  formatBankStatementImportMessage,
  invokeBankStatementImport,
  isBankStatementBankName,
  validateBankStatementFile,
} from "@/lib/bank/statement-upload";

describe("Bank statement upload helpers", () => {
  it("targets the Edge Function import-bank-statement", () => {
    expect(BANK_STATEMENT_IMPORT_FN).toBe("import-bank-statement");
  });

  it("accepts only KBANK / KTB bank names", () => {
    expect(isBankStatementBankName("KBANK")).toBe(true);
    expect(isBankStatementBankName("KTB")).toBe(true);
    expect(isBankStatementBankName("SCB")).toBe(false);
  });

  it("validates Excel extension and size", () => {
    const ok = new File(["x"], "KBANK3557_07.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(validateBankStatementFile(ok)).toBeNull();

    const badExt = new File(["x"], "notes.csv", { type: "text/csv" });
    expect(validateBankStatementFile(badExt)).toMatch(/xlsx/i);

    const big = new File(
      [new Uint8Array(BANK_STATEMENT_MAX_BYTES + 1)],
      "big.xlsx"
    );
    expect(validateBankStatementFile(big)).toMatch(/15/);
  });

  it("formats imported / skipped / failed messages", () => {
    expect(
      formatBankStatementImportMessage({
        status: "imported",
        original_filename: "a.xlsx",
        account_no: "141-1-72355-7",
        row_count: 10,
        inserted_count: 8,
        duplicate_count: 2,
      })
    ).toContain("นำเข้าสำเร็จ");

    expect(
      formatBankStatementImportMessage({
        status: "skipped",
        original_filename: "a.xlsx",
      })
    ).toContain("ข้าม");

    expect(
      formatBankStatementImportMessage({
        status: "failed",
        error: "parse error",
      })
    ).toBe("parse error");
  });

  it("invokes the Edge Function with FormData fields", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        status: "imported",
        original_filename: "a.xlsx",
        inserted_count: 1,
        row_count: 1,
      },
      error: null,
    });
    const supabase = { functions: { invoke } } as never;
    const file = new File(["x"], "a.xlsx");

    const outcome = await invokeBankStatementImport({
      supabase,
      file,
      bankName: "KBANK",
    });

    expect(outcome.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith("import-bank-statement", {
      body: expect.any(FormData),
    });
    const form = invoke.mock.calls[0][1].body as FormData;
    expect(form.get("bank_name")).toBe("KBANK");
    expect(form.get("file")).toBeInstanceOf(File);
  });
});

describe("Bank statement sync RBAC", () => {
  it("exposes bank_statement_sync page key", () => {
    expect(BANK_PAGE_KEYS.statementSync).toBe("bank_statement_sync");
    expect(canAccessStatementSync(["*"])).toBe(true);
    expect(canAccessStatementSync(["bank_statement_sync"])).toBe(true);
    expect(canAccessStatementSync(["po_status"])).toBe(false);
  });
});

describe("Bank Statement page uses upload UI (not worker sync)", () => {
  it("opens StatementUploadDialog and does not call /api/bank/sync", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/components/bank/BankStatementSyncPage.tsx"),
      "utf8"
    );
    expect(page).toContain("StatementUploadDialog");
    expect(page).toContain("อัปโหลด Statement");
    expect(page).not.toContain("/api/bank/sync");
    expect(page).not.toContain("/api/bank/meta");
    expect(page).not.toContain("Bank Sync");
  });
});
