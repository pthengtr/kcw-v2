import type { SupabaseClient } from "@supabase/supabase-js";

export const BANK_STATEMENT_IMPORT_FN = "import-bank-statement";

export const BANK_STATEMENT_BANKS = ["KBANK", "KTB"] as const;
export type BankStatementBankName = (typeof BANK_STATEMENT_BANKS)[number];

export const BANK_STATEMENT_ACCEPT =
  ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12";

/** Max upload size matching the Edge Function / Storage limit. */
export const BANK_STATEMENT_MAX_BYTES = 15 * 1024 * 1024;

const EXCEL_EXT = /\.(xlsx|xls|xlsm)$/i;

/** Multipart filename Deno can parse. iOS often sends the real name unencoded. */
export function asciiUploadName(name: string): string {
  const ext = (name.match(EXCEL_EXT)?.[0] ?? ".xlsx").toLowerCase();
  const base = name.replace(EXCEL_EXT, "");
  const ascii = base
    .replace(/[^\w.\-()]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${ascii || "statement"}${ext}`;
}

export type BankStatementImportStatus = "imported" | "skipped" | "failed";

export type BankStatementSheetSummary = {
  sheet_name?: string | null;
  account_no?: string | null;
  row_count?: number | null;
  skipped?: boolean | null;
};

export type BankStatementImportResult = {
  status: BankStatementImportStatus;
  file_id?: string | null;
  file_hash?: string | null;
  bank_name?: string | null;
  account_no?: string | null;
  account_nos?: string[] | null;
  sheet_summaries?: BankStatementSheetSummary[] | null;
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

function formatImportAccounts(result: BankStatementImportResult): string {
  const fromList = (result.account_nos ?? [])
    .map((a) => String(a).trim())
    .filter(Boolean);
  if (fromList.length) return ` · บัญชี ${fromList.join(", ")}`;
  return result.account_no ? ` · บัญชี ${result.account_no}` : "";
}

export function formatBankStatementImportMessage(
  result: BankStatementImportResult
): string {
  const name = result.original_filename ?? "ไฟล์";
  const account = formatImportAccounts(result);
  const sheetCount = (result.sheet_summaries ?? []).filter(
    (s) => (s.row_count ?? 0) > 0
  ).length;
  const sheets = sheetCount > 1 ? ` · ${sheetCount} แท็บ` : "";
  const counts =
    result.row_count != null
      ? ` · ${result.inserted_count ?? 0}/${result.row_count} แถวใหม่` +
        (result.duplicate_count
          ? ` (ซ้ำ ${result.duplicate_count})`
          : "")
      : "";

  if (result.status === "imported") {
    return `นำเข้าสำเร็จ: ${name}${account}${sheets}${counts}`;
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

  // Read the file first. iOS hands back a File that is not fully in the
  // multipart body until it is copied. Send that copy with fetch, not
  // supabase.functions.invoke: the SDK wraps headers in a Headers object and
  // mobile Safari then omits the multipart boundary, so Deno reports
  // "Unable to parse body as form data".
  const bytes = await file.arrayBuffer();
  const blob = new Blob([bytes], {
    type: file.type || "application/octet-stream",
  });
  const form = new FormData();
  form.append("file", blob, asciiUploadName(file.name));
  form.append("bank_name", bankName);
  form.append("original_filename", file.name);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, message: "กรุณาเข้าสู่ระบบใหม่" };

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!baseUrl) return { ok: false, message: "ไม่พบที่อยู่เซิร์ฟเวอร์" };

  const res = await fetch(
    `${baseUrl}/functions/v1/${BANK_STATEMENT_IMPORT_FN}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: form,
    }
  );

  let data: BankStatementImportResult | null = null;
  try {
    data = (await res.json()) as BankStatementImportResult;
  } catch {
    data = null;
  }
  if (!res.ok) {
    return {
      ok: false,
      message:
        data?.error ||
        data?.message ||
        `เรียก Edge Function ไม่สำเร็จ (${res.status})`,
      result: data ?? undefined,
    };
  }

  const result = data ?? ({} as BankStatementImportResult);
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
