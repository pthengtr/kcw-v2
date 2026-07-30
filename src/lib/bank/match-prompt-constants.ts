export const BANK_MATCH_AGENT_NAME = "จับคู่ยอดเข้า";

/** Preferred default account in the Statement Lines picker. */
export const BANK_MATCH_ACCOUNT_NO = "7236";

/**
 * Account → matcher prompt path.
 * Keep browser-safe (no `fs`) so client components can import this module.
 */
export const BANK_MATCH_PROMPTS: Record<string, string> = {
  "7236": "prompts/bank-statement-match-7236.md",
  "3557": "prompts/bank-statement-match-3557.md",
  "0393": "prompts/bank-statement-match-0393.md",
  /** KBANK OpEx paying account (took over 0393 expense payments from Jul 2026). */
  "4759": "prompts/bank-statement-match-4759.md",
  /** KTB marketplace settlements (account ends with 1139). */
  "248-0-42113-9": "prompts/bank-statement-match-1139.md",
  /** KTB payroll + OpEx cheques (account ends with 6184). */
  "248-6-00618-4": "prompts/bank-statement-match-6184.md",
};

/** Stable display / allow-list order. */
export const BANK_MATCH_ACCOUNT_NOS = [
  "7236",
  "3557",
  "0393",
  "4759",
  "248-0-42113-9",
  "248-6-00618-4",
] as const;

/** @deprecated Prefer getBankMatchPromptPath(accountNo). Kept for older imports. */
export const BANK_MATCH_PROMPT_RELATIVE_PATH =
  BANK_MATCH_PROMPTS[BANK_MATCH_ACCOUNT_NO];

export function isBankMatchAccount(accountNo: string): boolean {
  return Object.prototype.hasOwnProperty.call(BANK_MATCH_PROMPTS, accountNo);
}

export function getBankMatchPromptPath(accountNo: string): string | null {
  return BANK_MATCH_PROMPTS[accountNo] ?? null;
}

export function bankMatchAccountsLabel(
  accounts: readonly string[] = BANK_MATCH_ACCOUNT_NOS
): string {
  return accounts.join(", ");
}
