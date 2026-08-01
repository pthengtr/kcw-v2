import { describe, expect, it, vi } from "vitest";

import {
  collapseStatementAccounts,
  listStatementAccounts,
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

function mockAccountsClient(rangeFn: ReturnType<typeof vi.fn>) {
  const query = {
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    range: rangeFn,
  };
  query.gte.mockImplementation(() => query);
  query.lte.mockImplementation(() => query);
  query.order.mockImplementation(() => query);

  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return { schema, query, range: rangeFn };
}

const july: StatementAccountDateRange = {
  from: "2026-07-01",
  to: "2026-07-31",
};

describe("listStatementAccounts", () => {
  it("filters by month range before paging", async () => {
    const rows = [
      { account_no: "064-8-91723-6", bank_name: "KBANK" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
    ];
    const rangeFn = vi.fn().mockResolvedValue({ data: rows, error: null });
    const client = mockAccountsClient(rangeFn);

    const accounts = await listStatementAccounts(client, july, 1000);

    expect(client.query.gte).toHaveBeenCalledWith("txn_date", "2026-07-01");
    expect(client.query.lte).toHaveBeenCalledWith("txn_date", "2026-07-31");
    expect(rangeFn).toHaveBeenCalledTimes(1);
    expect(rangeFn).toHaveBeenCalledWith(0, 999);
    expect(accounts).toEqual([
      { account_no: "064-8-91723-6", bank_name: "KBANK" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
    ]);
  });

  it("pages past the default 1000-row cap so later accounts appear", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      account_no: i < 999 ? "064-8-91723-6" : "248-0-42113-9",
      bank_name: i < 999 ? "KBANK" : "KTB",
    }));
    const page2 = [
      { account_no: "248-0-42113-9", bank_name: "KTB" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
      { account_no: "248-6-00618-4", bank_name: "KBANK" },
    ];

    const rangeFn = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });
    const client = mockAccountsClient(rangeFn);

    const accounts = await listStatementAccounts(client, july, 1000);

    expect(rangeFn).toHaveBeenCalledTimes(2);
    expect(rangeFn).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeFn).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(accounts).toEqual([
      { account_no: "064-8-91723-6", bank_name: "KBANK" },
      { account_no: "248-0-42113-9", bank_name: "KTB" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
    ]);
  });

  it("rejects inverted date ranges", async () => {
    const client = mockAccountsClient(vi.fn());
    await expect(
      listStatementAccounts(client, {
        from: "2026-07-31",
        to: "2026-07-01",
      })
    ).rejects.toThrow("`from` must be on or before `to`");
  });

  it("surfaces query errors", async () => {
    const rangeFn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const client = mockAccountsClient(rangeFn);

    await expect(listStatementAccounts(client, july)).rejects.toThrow("boom");
  });
});
