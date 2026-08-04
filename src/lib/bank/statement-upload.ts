import type { SupabaseClient } from "@supabase/supabase-js";

export const BANK_STATEMENT_IMPORT_FN = "import-bank-statement";

export const BANK_STATEMENT_BANKS = ["KBANK", "KTB"] as const;
export type BankStatementBankName = (typeof BANK_STATEMENT_BANKS)[number];

export const BANK_STATEMENT_ACCEPT =
  ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12";

/** Max upload size matching the Edge Function / Storage limit. */
export const BANK_STATEMENT_MAX_BYTES = 15 * 1024 * 1024;

const EXCEL_EXT = /\.(xlsx|xls|xlsm)$/i;

export type BankStatementImportStatus = "imported" | "skipped" | "failed";

export type BankStatementImportResult = {
  status: BankStatementImportStatus;
  file_id?: string | null;
  file_hash?: string | null;
  bank_name?: string | null;
  account_no?: string | null;
  original_filename?: string | null;
  source_path?: string | null;
  is_new_file?: boolean | null;
  row_count?: number | null;
  inserted_count?: number | null;
  duplicate_count?: number | null;
  storage_error?: string | null;
  error?: string | null;
  message?: string | null;
};

export function isBankStatementBankName(
  value: string
): value is BankStatementBankName {
  return (BANK_STATEMENT_BANKS as readonly string[]).includes(value);
}

export function validateBankStatementFile(file: File): string | null {
  if (!file || file.size <= 0) return "กรุณาเลือกไฟล์ Excel";
  if (file.size > BANK_STATEMENT_MAX_BYTES) {
    return "ไฟล์ใหญ่เกิน 15 MB";
  }
  if (!EXCEL_EXT.test(file.name)) {
    return "รองรับเฉพาะไฟล์ .xlsx / .xls / .xlsm";
  }
  return null;
}

export function formatBankStatementImportMessage(
  result: BankStatementImportResult
): string {
  const name = result.original_filename ?? "ไฟล์";
  const account = result.account_no ? ` · บัญชี ${result.account_no}` : "";
  const counts =
    result.row_count != null
      ? ` · ${result.inserted_count ?? 0}/${result.row_count} แถวใหม่` +
        (result.duplicate_count
          ? ` (ซ้ำ ${result.duplicate_count})`
          : "")
      : "";

  if (result.status === "imported") {
    return `นำเข้าสำเร็จ: ${name}${account}${counts}`;
  }
  if (result.status === "skipped") {
    return `ข้าม (ไฟล์ซ้ำ): ${name}${account}`;
  }
  return (
    result.error ||
    result.message ||
    result.storage_error ||
    `นำเข้าล้มเหลว: ${name}`
  );
}

export async function invokeBankStatementImport(params: {
  supabase: SupabaseClient;
  file: File;
  bankName: BankStatementBankName;
}): Promise<
  | { ok: true; result: BankStatementImportResult }
  | { ok: false; message: string; result?: BankStatementImportResult }
> {
  const { supabase, file, bankName } = params;

  const fileError = validateBankStatementFile(file);
  if (fileError) return { ok: false, message: fileError };
  if (!isBankStatementBankName(bankName)) {
    return { ok: false, message: "เลือกธนาคาร KBANK หรือ KTB" };
  }

  const form = new FormData();
  form.append("file", file);
  form.append("bank_name", bankName);

  // Do not set Content-Type manually — the browser/SDK sets the multipart boundary.
  const { data, error } = await supabase.functions.invoke(
    BANK_STATEMENT_IMPORT_FN,
    { body: form }
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
      }
    } catch {
      // keep detail from error.message
    }
    return { ok: false, message: detail };
  }

  const result = (data ?? {}) as BankStatementImportResult;
  if (!result.status) {
    return { ok: false, message: "ตอบกลับจาก Edge Function ไม่ถูกต้อง" };
  }
  if (result.status === "failed") {
    return {
      ok: false,
      message: formatBankStatementImportMessage(result),
      result,
    };
  }
  return { ok: true, result };
}
