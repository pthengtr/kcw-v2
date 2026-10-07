import { describe, expect, it } from "vitest";

import {
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
