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
  gte: (column: string, value: string) => StatementAccountQuery;
  lte: (column: string, value: string) => StatementAccountQuery;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => StatementAccountQuery;
  range: (from: number, to: number) => PromiseLike<QueryResult>;
};

type StatementLinesAccountsClient = {
  schema: (schema: string) => {
    from: (table: string) => {
      select: (columns: string) => unknown;
    };
  };
};

/**
 * List distinct accounts that have statement lines in `[from, to]`.
 * Still pages in case a single month exceeds the PostgREST max-rows cap.
 */
export async function listStatementAccounts(
  supabase: StatementLinesAccountsClient,
  range: StatementAccountDateRange,
  pageSize = 1000
): Promise<BankAccountOption[]> {
  if (pageSize < 1) {
    throw new Error("pageSize must be >= 1");
  }
  if (!range.from || !range.to) {
    throw new Error("`from` and `to` are required");
  }
  if (range.from > range.to) {
    throw new Error("`from` must be on or before `to`");
  }

  const collected: AccountBankRow[] = [];
  let offset = 0;

  for (;;) {
    const query = supabase
      .schema("bank")
      .from("statement_lines")
      .select("account_no, bank_name") as StatementAccountQuery;

    const { data, error } = await query
      .gte("txn_date", range.from)
      .lte("txn_date", range.to)
      .order("account_no", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    collected.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return collapseStatementAccounts(collected);
}
