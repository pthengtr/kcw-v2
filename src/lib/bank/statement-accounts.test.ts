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

    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });

    const orderId = vi.fn(() => ({ range }));
    const orderAccount = vi.fn(() => ({ order: orderId }));
    const select = vi.fn(() => ({ order: orderAccount }));
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    const accounts = await listStatementAccounts({ schema }, 1000);

    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(accounts).toEqual([
      { account_no: "064-8-91723-6", bank_name: "KBANK" },
      { account_no: "248-0-42113-9", bank_name: "KTB" },
      { account_no: "248-6-00618-4", bank_name: "KTB" },
    ]);
  });

  it("surfaces query errors", async () => {
    const range = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const orderId = vi.fn(() => ({ range }));
    const orderAccount = vi.fn(() => ({ order: orderId }));
    const select = vi.fn(() => ({ order: orderAccount }));
    const from = vi.fn(() => ({ select }));
    const schema = vi.fn(() => ({ from }));

    await expect(listStatementAccounts({ schema }, 1000)).rejects.toThrow(
      "boom"
    );
  });
});
