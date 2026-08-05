import { describe, expect, it, vi } from "vitest";

import {
  BANK_STATEMENT_REPORT_FN,
  defaultBankStatementReportMonth,
  formatBankStatementReportMessage,
  invokeBankStatementReport,
  parseReportMonth,
} from "@/lib/bank/statement-report";

describe("Bank statement report helpers", () => {
  it("targets the Edge Function generate-bank-statement-report", () => {
    expect(BANK_STATEMENT_REPORT_FN).toBe("generate-bank-statement-report");
  });

  it("defaults to previous month when day < 11", () => {
    expect(defaultBankStatementReportMonth(new Date(2026, 7, 5))).toBe(
      "2026-07"
    );
    expect(defaultBankStatementReportMonth(new Date(2026, 7, 11))).toBe(
      "2026-08"
    );
  });

  it("parses YYYY-MM months", () => {
    expect(parseReportMonth("2026-07")).toEqual({ year: 2026, month: 7 });
    expect(parseReportMonth("2026-13")).toBeNull();
    expect(parseReportMonth("bad")).toBeNull();
  });

  it("formats generated / failed messages", () => {
    expect(
      formatBankStatementReportMessage({
        status: "generated",
        filename: "bank_statement_report_2026_07.xlsx",
        year: 2026,
        month: 7,
        row_count: 405,
        sheet_names: ["KBANK_a", "KTB_b"],
      })
    ).toMatch(/สำเร็จ.*2026-07.*405.*2 บัญชี/);

    expect(
      formatBankStatementReportMessage({
        status: "failed",
        error: "No bank.statement_lines for 2026-01",
      })
    ).toBe("No bank.statement_lines for 2026-01");
  });

  it("invokes the Edge Function with year/month JSON", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        status: "generated",
        year: 2026,
        month: 7,
        filename: "bank_statement_report_2026_07.xlsx",
        signed_url: "https://example.test/file.xlsx",
        row_count: 10,
        sheet_names: ["KBANK_x"],
      },
      error: null,
    });
    const supabase = { functions: { invoke } } as never;

    const outcome = await invokeBankStatementReport({
      supabase,
      year: 2026,
      month: 7,
    });

    expect(invoke).toHaveBeenCalledWith(BANK_STATEMENT_REPORT_FN, {
      body: { year: 2026, month: 7 },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.signed_url).toContain("example.test");
    }
  });

  it("rejects invalid months before invoke", async () => {
    const invoke = vi.fn();
    const supabase = { functions: { invoke } } as never;
    const outcome = await invokeBankStatementReport({
      supabase,
      year: 2026,
      month: 13,
    });
    expect(outcome.ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
