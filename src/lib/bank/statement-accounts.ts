export type BankAccountOption = {
  account_no: string;
  bank_name: string | null;
};

export type StatementAccountDateRange = {
  from: string;
  to: string;
};

type AccountBankRow = {
  account_no: string | null;
  bank_name: string | null;
};

/**
 * Collapse statement_lines rows into distinct accounts.
 * When the same account_no appears under multiple bank_name values,
 * keep the majority label (ties prefer the first seen non-null name).
 */
export function collapseStatementAccounts(
  rows: readonly AccountBankRow[]
): BankAccountOption[] {
  const counts = new Map<string, Map<string | null, number>>();
  const firstSeenBank = new Map<string, string | null>();

  for (const row of rows) {
    const accountNo = row.account_no?.trim();
    if (!accountNo) continue;
    const bank = row.bank_name ?? null;

    let bankCounts = counts.get(accountNo);
    if (!bankCounts) {
      bankCounts = new Map();
      counts.set(accountNo, bankCounts);
      firstSeenBank.set(accountNo, bank);
    }
    bankCounts.set(bank, (bankCounts.get(bank) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([account_no, bankCounts]) => {
      let bestBank = firstSeenBank.get(account_no) ?? null;
      let bestCount = -1;
      for (const [bank, n] of bankCounts) {
        if (n > bestCount) {
          bestCount = n;
          bestBank = bank;
        }
      }
      return { account_no, bank_name: bestBank };
    })
    .sort((a, b) => a.account_no.localeCompare(b.account_no));
}

type QueryResult = {
  data: AccountBankRow[] | null;
  error: { message: string } | null;
};

type StatementAccountQuery = {
  eq: (column: string, value: string) => StatementAccountQuery;
  gte: (column: string, value: string) => StatementAccountQuery;
  lte: (column: string, value: string) => StatementAccountQuery;
  not: (
    column: string,
    operator: string,
    value: null
  ) => StatementAccountQuery;
  limit: (count: number) => PromiseLike<QueryResult>;
};

/** Loose client shape — real Supabase admin client and vitest mocks both work. */
export type StatementLinesAccountsClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: (schema: string) => any;
};

/** Sample size for bank_name majority within one account+month probe. */
const ACCOUNT_PROBE_SAMPLE = 20;

/**
 * Candidate account numbers come from import files (small table), not from
 * scanning every statement line.
 */
export async function listCandidateAccountNos(
  supabase: StatementLinesAccountsClient
): Promise<string[]> {
  const query = supabase
    .schema("bank")
    .from("statement_import_files")
    .select("account_no") as StatementAccountQuery;

  const { data, error } = await query
    .not("account_no", "is", null)
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  const seen = new Set<string>();
  for (const row of data ?? []) {
    const accountNo = row.account_no?.trim();
    if (accountNo) seen.add(accountNo);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Probe one account inside a month window (uses account_no + txn_date index).
 * Returns null when that account has no lines in range.
 */
export async function probeStatementAccountInRange(
  supabase: StatementLinesAccountsClient,
  accountNo: string,
  range: StatementAccountDateRange,
  sampleSize = ACCOUNT_PROBE_SAMPLE
): Promise<BankAccountOption | null> {
  const trimmed = accountNo.trim();
  if (!trimmed) return null;

  const query = supabase
    .schema("bank")
    .from("statement_lines")
    .select("account_no, bank_name") as StatementAccountQuery;

  const { data, error } = await query
    .eq("account_no", trimmed)
    .gte("txn_date", range.from)
    .lte("txn_date", range.to)
    .limit(sampleSize);

  if (error) {
    throw new Error(error.message);
  }

  const collapsed = collapseStatementAccounts(data ?? []);
  return collapsed[0] ?? null;
}

/**
 * List accounts that have statement lines in `[from, to]`.
 * Never scans "month + all accounts" as one query — candidates come from
 * import files, then each account is probed with month + account_no.
 */
export async function listStatementAccounts(
  supabase: StatementLinesAccountsClient,
  range: StatementAccountDateRange,
  options?: {
    candidateAccountNos?: readonly string[];
    sampleSize?: number;
  }
): Promise<BankAccountOption[]> {
  if (!range.from || !range.to) {
    throw new Error("`from` and `to` are required");
  }
  if (range.from > range.to) {
    throw new Error("`from` must be on or before `to`");
  }

  const candidates =
    options?.candidateAccountNos?.map((a) => a.trim()).filter(Boolean) ??
    (await listCandidateAccountNos(supabase));

  const found = await Promise.all(
    candidates.map((accountNo) =>
      probeStatementAccountInRange(
        supabase,
        accountNo,
        range,
        options?.sampleSize
      )
    )
  );

  return found
    .filter((a): a is BankAccountOption => a != null)
    .sort((a, b) => a.account_no.localeCompare(b.account_no));
}
