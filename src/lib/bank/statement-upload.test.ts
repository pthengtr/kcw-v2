import { describe, expect, it, vi } from "vitest";

import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessStatementSync } from "@/lib/auth/client-permissions";
import {
  BANK_STATEMENT_IMPORT_FN,
  BANK_STATEMENT_MAX_BYTES,
  formatBankStatementImportMessage,
  invokeBankStatementImport,
  isBankStatementBankName,
  asciiUploadName,
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
        status: "imported",
        original_filename: "6184-1139 W1-23 D8.xls",
        account_no: "248-0-42113-9, 248-6-00618-4",
        account_nos: ["248-0-42113-9", "248-6-00618-4"],
        sheet_summaries: [
          { sheet_name: "248-0-42113-9", account_no: "248-0-42113-9", row_count: 27 },
          { sheet_name: "248-6-00618-4", account_no: "248-6-00618-4", row_count: 32 },
        ],
        row_count: 59,
        inserted_count: 59,
        duplicate_count: 0,
      })
    ).toBe(
      "นำเข้าสำเร็จ: 6184-1139 W1-23 D8.xls · บัญชี 248-0-42113-9, 248-6-00618-4 · 2 แท็บ · 59/59 แถวใหม่"
    );

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

  it("keeps an ASCII multipart filename and the real name beside it", () => {
    expect(asciiUploadName("KBANK W1-8.xlsx")).toBe("KBANK_W1-8.xlsx");
    expect(asciiUploadName("สเตทเมนต์.xlsx")).toBe("statement.xlsx");
  });

  it("posts FormData with fetch and does not set Content-Type", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "imported",
        original_filename: "สเตทเมนต์.xlsx",
        inserted_count: 1,
        row_count: 1,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const supabase = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "tok" } },
        }),
      },
    } as never;
    const file = new File(["x"], "สเตทเมนต์.xlsx");

    const outcome = await invokeBankStatementImport({
      supabase,
      file,
      bankName: "KBANK",
    });

    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://example.supabase.co/functions/v1/import-bank-statement"
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers.apikey).toBe("anon-key");
    expect(headers["Content-Type"]).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get("bank_name")).toBe("KBANK");
    expect(form.get("original_filename")).toBe("สเตทเมนต์.xlsx");
    expect(form.get("file")).toBeInstanceOf(Blob);
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
