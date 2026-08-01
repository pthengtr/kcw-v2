import { describe, expect, it, vi } from "vitest";

import {
  collapseStatementAccounts,
  listStatementAccounts,
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

describe("listStatementAccounts", () => {
  it("lists known accounts from import files and returns latest month", async () => {
    const filesChain = {
      not: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { account_no: "248-6-00618-4", bank_name: "KBANK" },
          { account_no: "248-6-00618-4", bank_name: "KTB" },
          { account_no: "248-6-00618-4", bank_name: "KTB" },
          { account_no: "064-8-91723-6", bank_name: "KBANK" },
        ],
        error: null,
      }),
    };
    filesChain.not.mockImplementation(() => filesChain);

    const latestChain = {
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: [{ txn_date: "2026-07-31" }],
        error: null,
      }),
    };
    latestChain.order.mockImplementation(() => latestChain);

    const from = vi.fn((table: string) => {
      if (table === "statement_import_files") {
        return {
          select: vi.fn(() => filesChain),
        };
      }
      if (table === "statement_lines") {
        return {
          select: vi.fn(() => latestChain),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await listStatementAccounts({
      schema: vi.fn(() => ({ from })),
    });

    expect(filesChain.not).toHaveBeenCalledWith("account_no", "is", null);
    expect(latestChain.order).toHaveBeenCalledWith("txn_date", {
      ascending: false,
    });
    expect(result).toEqual({
      accounts: [
        { account_no: "064-8-91723-6", bank_name: "KBANK" },
        { account_no: "248-6-00618-4", bank_name: "KTB" },
      ],
      latestMonth: "2026-07",
    });
  });

  it("surfaces import-file query errors", async () => {
    const filesChain = {
      not: vi.fn(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "boom" },
      }),
    };
    filesChain.not.mockImplementation(() => filesChain);

    const latestChain = {
      order: vi.fn(() => latestChain),
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const from = vi.fn((table: string) => ({
      select: vi.fn(() =>
        table === "statement_import_files" ? filesChain : latestChain
      ),
    }));

    await expect(
      listStatementAccounts({ schema: vi.fn(() => ({ from })) })
    ).rejects.toThrow("boom");
  });
});
