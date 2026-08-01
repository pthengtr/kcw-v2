export type BankAccountOption = {
  account_no: string;
  bank_name: string | null;
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

type StatementLinesAccountsClient = {
  schema: (schema: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => {
            range: (
              from: number,
              to: number
            ) => PromiseLike<{
              data: AccountBankRow[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
};

/**
 * Page through statement_lines so accounts past the PostgREST/Supabase
 * default max-rows (often 1000) are still included in the dropdown.
 */
export async function listStatementAccounts(
  supabase: StatementLinesAccountsClient,
  pageSize = 1000
): Promise<BankAccountOption[]> {
  if (pageSize < 1) {
    throw new Error("pageSize must be >= 1");
  }

  const collected: AccountBankRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .schema("bank")
      .from("statement_lines")
      .select("account_no, bank_name")
      .order("account_no", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    collected.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return collapseStatementAccounts(collected);
}
