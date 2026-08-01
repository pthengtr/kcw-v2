import { describe, expect, it, vi } from "vitest";

import {
  collapseStatementAccounts,
  listCandidateAccountNos,
  listStatementAccounts,
  probeStatementAccountInRange,
  type StatementAccountDateRange,
} from "@/lib/bank/statement-accounts";

describe("collapseStatementAccounts", () => {
  it("returns distinct accounts sorted by account_no", () => {
    expect(
      collapseStatementAccounts([
        { account_no: "248-6-00618-4", bank_name: "KTB" },
        { account_no: "064-8-91723-6", bank_name: "KBANK" },
        { account_no: " 064-8-91723-6 ", bank_name: "KBANK" },
        { account_no: null, bank_name: "KBANK" },
        { account_no: "   ", bank_name: "KBANK" },
      ])
    ).toEqual([
      { account_no: "064-8-91723-6", bank_name: "KBANK" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
    ]);
  });

  it("prefers the majority bank_name when an account is mislabeled", () => {
    expect(
      collapseStatementAccounts([
        { account_no: "248-6-00618-4", bank_name: "KBANK" },
        { account_no: "248-6-00618-4", bank_name: "KTB" },
        { account_no: "248-6-00618-4", bank_name: "KTB" },
      ])
    ).toEqual([{ account_no: "248-6-00618-4", bank_name: "KTB" }]);
  });
});

function mockTableClient(handlers: {
  importFiles?: ReturnType<typeof vi.fn>;
  statementLines?: ReturnType<typeof vi.fn>;
}) {
  const from = vi.fn((table: string) => {
    if (table === "statement_import_files") {
      return { select: handlers.importFiles ?? vi.fn() };
    }
    if (table === "statement_lines") {
      return { select: handlers.statementLines ?? vi.fn() };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { schema: vi.fn(() => ({ from })), from };
}

function mockChain(result: {
  data: Array<{ account_no: string | null; bank_name?: string | null }> | null;
  error: { message: string } | null;
}) {
  const chain = {
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    not: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.eq.mockImplementation(() => chain);
  chain.gte.mockImplementation(() => chain);
  chain.lte.mockImplementation(() => chain);
  chain.not.mockImplementation(() => chain);
  const select = vi.fn(() => chain);
  return { select, chain };
}

const july: StatementAccountDateRange = {
  from: "2026-07-01",
  to: "2026-07-31",
};

describe("listCandidateAccountNos", () => {
  it("reads distinct account numbers from import files", async () => {
    const { select, chain } = mockChain({
      data: [
        { account_no: "248-6-00618-4" },
        { account_no: "064-8-91723-6" },
        { account_no: "248-6-00618-4" },
        { account_no: null },
      ],
      error: null,
    });
    const client = mockTableClient({ importFiles: select });

    await expect(listCandidateAccountNos(client)).resolves.toEqual([
      "064-8-91723-6",
      "248-6-00618-4",
    ]);
    expect(client.from).toHaveBeenCalledWith("statement_import_files");
    expect(chain.not).toHaveBeenCalledWith("account_no", "is", null);
  });
});

describe("probeStatementAccountInRange", () => {
  it("probes one account with month + account filters", async () => {
    const { select, chain } = mockChain({
      data: [
        { account_no: "248-6-00618-4", bank_name: "KBANK" },
        { account_no: "248-6-00618-4", bank_name: "KTB" },
        { account_no: "248-6-00618-4", bank_name: "KTB" },
      ],
      error: null,
    });
    const client = mockTableClient({ statementLines: select });

    await expect(
      probeStatementAccountInRange(client, "248-6-00618-4", july)
    ).resolves.toEqual({
      account_no: "248-6-00618-4",
      bank_name: "KTB",
    });

    expect(client.from).toHaveBeenCalledWith("statement_lines");
    expect(chain.eq).toHaveBeenCalledWith("account_no", "248-6-00618-4");
    expect(chain.gte).toHaveBeenCalledWith("txn_date", "2026-07-01");
    expect(chain.lte).toHaveBeenCalledWith("txn_date", "2026-07-31");
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it("returns null when the account has no rows in range", async () => {
    const { select } = mockChain({ data: [], error: null });
    const client = mockTableClient({ statementLines: select });

    await expect(
      probeStatementAccountInRange(client, "248-6-00618-4", july)
    ).resolves.toBeNull();
  });
});

describe("listStatementAccounts", () => {
  it("probes each candidate with month + account, never full-month scan", async () => {
    const statementSelect = vi.fn((columns: string) => {
      expect(columns).toBe("account_no, bank_name");
      const chain = {
        eq: vi.fn(),
        gte: vi.fn(),
        lte: vi.fn(),
        limit: vi.fn(),
      };
      chain.eq.mockImplementation((col: string, value: string) => {
        expect(col).toBe("account_no");
        chain.limit.mockResolvedValue({
          data:
            value === "248-6-00618-4"
              ? [{ account_no: value, bank_name: "KTB" }]
              : value === "064-8-91723-6"
                ? [{ account_no: value, bank_name: "KBANK" }]
                : [],
          error: null,
        });
        return chain;
      });
      chain.gte.mockImplementation(() => chain);
      chain.lte.mockImplementation(() => chain);
      return chain;
    });

    const client = mockTableClient({ statementLines: statementSelect });

    const accounts = await listStatementAccounts(client, july, {
      candidateAccountNos: [
        "064-8-91723-6",
        "999-9-99999-9",
        "248-6-00618-4",
      ],
    });

    expect(statementSelect).toHaveBeenCalledTimes(3);
    expect(accounts).toEqual([
      { account_no: "064-8-91723-6", bank_name: "KBANK" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
    ]);
  });

  it("rejects inverted date ranges", async () => {
    const client = mockTableClient({});
    await expect(
      listStatementAccounts(client, {
        from: "2026-07-31",
        to: "2026-07-01",
      })
    ).rejects.toThrow("`from` must be on or before `to`");
  });
});
