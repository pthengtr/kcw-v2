import { describe, expect, it } from "vitest";

import {
  expenseReceiptTotals,
  statementExpenseReceipts,
  statementPurchaseBills,
  statementSalesBills,
  statementVoucherNo,
  voucherListSummary,
} from "./statement-doc-links";

const matched = { match_status: "matched" };

describe("statement document links", () => {
  it("opens one TR bill and a bundle", () => {
    expect(
      statementSalesBills({ ...matched, matched_ref_type: "tr_bill", matched_ref_id: "TR6909-052" })
    ).toEqual([{ billno: "TR6909-052", docType: "TR" }]);
    expect(
      statementSalesBills({
        ...matched,
        matched_ref_type: "tr_bundle",
        matched_ref_id: "TR6909-035,TR6909-036",
      })
    ).toEqual([
      { billno: "TR6909-035", docType: "TR" },
      { billno: "TR6909-036", docType: "TR" },
    ]);
    expect(
      statementSalesBills({
        ...matched,
        matched_ref_type: "tr_remainder",
        matched_ref_id: "3TR6909-019",
      })
    ).toEqual([{ billno: "3TR6909-019", docType: "3TR" }]);
  });

  it("skips unmatched rows and empty rvi refs", () => {
    expect(
      statementSalesBills({
        match_status: "unmatched",
        matched_ref_type: "tr_bill",
        matched_ref_id: "TR6909-052",
      })
    ).toBeNull();
    expect(
      statementVoucherNo({ ...matched, matched_ref_type: "rvi", matched_ref_id: null })
    ).toBeNull();
  });

  it("opens receipt and pay vouchers, and a purchase bill", () => {
    expect(
      statementVoucherNo({ ...matched, matched_ref_type: "rvmas", matched_ref_id: "RVI6909-037" })
    ).toBe("RVI6909-037");
    expect(
      statementVoucherNo({ ...matched, matched_ref_type: "pvmas", matched_ref_id: "P6903-002" })
    ).toBe("P6903-002");
    expect(
      statementPurchaseBills({
        ...matched,
        matched_ref_type: "pimas",
        matched_ref_id: "D-O-260800961",
      })
    ).toEqual(["D-O-260800961"]);
  });

  it("opens an expense voucher and skips account aliases", () => {
    const receipt = "cd579d46-38b1-4665-9d62-b1763e6ae63e";
    expect(
      statementExpenseReceipts({
        ...matched,
        matched_ref_type: "expense_pv",
        matched_ref_id: receipt,
      })
    ).toEqual([receipt]);
    expect(
      statementExpenseReceipts({
        ...matched,
        matched_ref_type: "expense_pv",
        matched_ref_id: "IV69080381",
      })
    ).toEqual(["IV69080381"]);
    expect(
      statementExpenseReceipts({
        ...matched,
        matched_ref_type: "expense_pv",
        matched_ref_id: `${receipt},82722277-094b-4ee9-81f2-5879929f2c4b`,
      })
    ).toHaveLength(2);
    expect(
      statementExpenseReceipts({
        ...matched,
        matched_ref_type: "expense_pv",
        matched_ref_id: "X2446",
      })
    ).toBeNull();
    expect(
      statementExpenseReceipts({
        match_status: "unmatched",
        matched_ref_type: "expense_pv",
        matched_ref_id: receipt,
      })
    ).toBeNull();
  });

  it("nets an expense voucher the same way as the expense screen", () => {
    expect(
      expenseReceiptTotals({
        lineAmounts: [1090],
        discount: 0,
        taxExempt: 0,
        vatRate: 0,
        withholdingRate: 0,
      })
    ).toMatchObject({ beforeTax: 1090, net: 1090 });
    expect(
      expenseReceiptTotals({
        lineAmounts: [9690.72],
        discount: 0,
        taxExempt: 0,
        vatRate: 0,
        withholdingRate: 3,
      }).net
    ).toBe(9400);
  });

  it("nets the voucher discount into the bill list total", () => {
    expect(
      voucherListSummary([
        { source: "purchase", amount: 2835.5, canceled: false },
        { source: "purchase", amount: 8384.42, canceled: false },
        { source: "discount", amount: -897.6, canceled: false },
      ])
    ).toEqual({ billCount: 2, total: 10322.32, discount: -897.6 });
  });
});
