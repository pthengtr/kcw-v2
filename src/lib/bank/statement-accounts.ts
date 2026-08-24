export type BankAccountOption = {
  account_no: string;
  bank_name: string | null;
};

type AccountBankRow = {
  account_no: string | null;
  bank_name: string | null;
  raw_metadata?: unknown;
};

/** Split a stored `account_no` that may list several tabs: `248-0-…, 248-6-…`. */
export function splitStoredAccountNos(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function accountsFromImportFileRow(row: AccountBankRow): AccountBankRow[] {
  const bank = row.bank_name ?? null;
  const nos = new Set<string>();
  for (const part of splitStoredAccountNos(row.account_no)) {
    nos.add(part);
  }
  const meta = row.raw_metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const extra = (meta as { account_nos?: unknown }).account_nos;
    if (Array.isArray(extra)) {
      for (const item of extra) {
        const account = String(item ?? "").trim();
        if (account) nos.add(account);
      }
    }
  }
  return [...nos].map((account_no) => ({ account_no, bank_name: bank }));
}

/**
 * Collapse rows into distinct accounts.
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

type LatestTxnResult = {
  data: { txn_date: string | null }[] | null;
  error: { message: string } | null;
};

type StatementAccountQuery = {
  not: (
    column: string,
    operator: string,
    value: null
  ) => StatementAccountQuery;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => StatementAccountQuery;
  limit: (count: number) => PromiseLike<QueryResult | LatestTxnResult>;
};

/** Loose client shape — real Supabase admin client and vitest mocks both work. */
export type StatementLinesAccountsClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: (schema: string) => any;
};

export type StatementAccountsResult = {
  accounts: BankAccountOption[];
  /** YYYY-MM of the latest statement line, if any. */
  latestMonth: string | null;
};

function toYearMonth(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4}-\d{2})/.exec(isoDate);
  return match?.[1] ?? null;
}

/**
 * Dropdown options come from the small import-files table (known accounts).
 * Statement line fetches stay scoped by month + account separately.
 */
export async function listStatementAccounts(
  supabase: StatementLinesAccountsClient
): Promise<StatementAccountsResult> {
  const filesQuery = supabase
    .schema("bank")
    .from("statement_import_files")
    .select("account_no, bank_name, raw_metadata") as StatementAccountQuery;

  const latestQuery = supabase
    .schema("bank")
    .from("statement_lines")
    .select("txn_date") as StatementAccountQuery;

  const [filesRes, latestRes] = await Promise.all([
    filesQuery.not("account_no", "is", null).limit(1000) as PromiseLike<QueryResult>,
    latestQuery
      .order("txn_date", { ascending: false })
      .limit(1) as PromiseLike<LatestTxnResult>,
  ]);

  if (filesRes.error) {
    throw new Error(filesRes.error.message);
  }
  if (latestRes.error) {
    throw new Error(latestRes.error.message);
  }

  return {
    accounts: collapseStatementAccounts(
      (filesRes.data ?? []).flatMap(accountsFromImportFileRow)
    ),
    latestMonth: toYearMonth(latestRes.data?.[0]?.txn_date),
  };
}
