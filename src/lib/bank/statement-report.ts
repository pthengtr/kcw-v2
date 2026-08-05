import type { SupabaseClient } from "@supabase/supabase-js";

export const BANK_STATEMENT_REPORT_FN = "generate-bank-statement-report";

export type BankStatementReportStatus = "generated" | "failed";

export type BankStatementReportResult = {
  status: BankStatementReportStatus;
  year?: number;
  month?: number;
  filename?: string | null;
  bucket?: string | null;
  storage_path?: string | null;
  signed_url?: string | null;
  signed_url_expires_in?: number | null;
  row_count?: number | null;
  sheet_names?: string[] | null;
  match_status_counts?: Record<string, number> | null;
  generated_by?: string | null;
  error?: string | null;
  message?: string | null;
};

/**
 * Default report month as YYYY-MM.
 * Same VAT-ish cycle as `getMonthBasedOn10th` (day < 11 → previous month).
 */
export function defaultBankStatementReportMonth(
  asOf: Date = new Date()
): string {
  const day = asOf.getDate();
  const base =
    day < 11
      ? new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1)
      : new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseReportMonth(
  value: string
): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function formatBankStatementReportMessage(
  result: BankStatementReportResult
): string {
  if (result.status === "generated") {
    const ym =
      result.year != null && result.month != null
        ? `${result.year}-${String(result.month).padStart(2, "0")}`
        : "";
    const rows =
      result.row_count != null ? ` · ${result.row_count} แถว` : "";
    const sheets = result.sheet_names?.length
      ? ` · ${result.sheet_names.length} บัญชี`
      : "";
    return `สร้างรายงานสำเร็จ: ${result.filename ?? "bank_statement_report.xlsx"}${
      ym ? ` (${ym})` : ""
    }${rows}${sheets}`;
  }
  return (
    result.error ||
    result.message ||
    "สร้างรายงานเดินบัญชีไม่สำเร็จ"
  );
}

export async function invokeBankStatementReport(params: {
  supabase: SupabaseClient;
  year: number;
  month: number;
}): Promise<
  | { ok: true; result: BankStatementReportResult }
  | { ok: false; message: string; result?: BankStatementReportResult }
> {
  const { supabase, year, month } = params;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: "ปีไม่ถูกต้อง" };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, message: "เดือนไม่ถูกต้อง (1-12)" };
  }

  const { data, error } = await supabase.functions.invoke(
    BANK_STATEMENT_REPORT_FN,
    { body: { year, month } }
  );

  if (error) {
    let detail = error.message || "เรียก Edge Function ไม่สำเร็จ";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = (await ctx.json()) as Record<string, unknown>;
        const msg =
          (typeof body.error === "string" && body.error) ||
          (typeof body.message === "string" && body.message) ||
          null;
        if (msg) detail = msg;
        if (body.status === "failed" || body.status === "generated") {
          const result = body as BankStatementReportResult;
          return {
            ok: false,
            message: formatBankStatementReportMessage(result),
            result,
          };
        }
      }
    } catch {
      // keep detail from error.message
    }
    return { ok: false, message: detail };
  }

  const result = (data ?? {}) as BankStatementReportResult;
  if (!result.status) {
    return { ok: false, message: "ตอบกลับจาก Edge Function ไม่ถูกต้อง" };
  }
  if (result.status !== "generated" || !result.signed_url) {
    return {
      ok: false,
      message: formatBankStatementReportMessage(result),
      result,
    };
  }
  return { ok: true, result };
}

/** Trigger browser download from a signed Storage URL. */
export function downloadFromSignedUrl(
  signedUrl: string,
  filename: string
): void {
  const a = document.createElement("a");
  a.href = signedUrl;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  a.click();
}
