/**
 * Per-worksheet account resolution for multi-tab bank statement Excel files.
 * KTB Corporate Online now exports one sheet per account, named like `248-0-42113-9`.
 */

/** Thai bank account pattern used on KTB sheet tabs, e.g. 248-0-42113-9 */
const DASHED_ACCOUNT_RE = /\d{3}-\d-\d{5}-\d/;

export type SheetParseSummary = {
  sheet_name: string;
  account_no: string;
  row_count: number;
  skipped: boolean;
};

export function extractAccountFromSheetName(sheetName: string): string {
  if (!sheetName) return "";
  const dashed = sheetName.match(DASHED_ACCOUNT_RE);
  return dashed ? dashed[0] : "";
}

/**
 * Resolve the account for one worksheet.
 * Priority: in-sheet metadata → account-like sheet name → prior sheet (in/out, months)
 * → filename fallback.
 */
export function resolveSheetAccount(opts: {
  metadataAccount?: string | null;
  sheetName: string;
  carriedAccount?: string | null;
  fallbackAccount?: string | null;
}): string {
  const meta = (opts.metadataAccount ?? "").trim();
  if (meta) return meta;
  const fromName = extractAccountFromSheetName(opts.sheetName);
  if (fromName) return fromName;
  const carried = (opts.carriedAccount ?? "").trim();
  if (carried) return carried;
  return (opts.fallbackAccount ?? "").trim();
}

export function uniqueAccountNos(accounts: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of accounts) {
    const account = raw.trim();
    if (!account || seen.has(account)) continue;
    seen.add(account);
    out.push(account);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Single text field for `statement_import_files.account_no` (ilike-filterable). */
export function formatFileAccountNo(accountNos: Iterable<string>): string | null {
  const unique = uniqueAccountNos(accountNos);
  if (!unique.length) return null;
  return unique.join(", ");
}
