import { describe, expect, it } from "vitest";

import {
  VAT_REGISTER_COLUMNS,
  visibleVatRegisterColumns,
  vatRegisterFooterPieces,
} from "./table-columns";

describe("vat register columns", () => {
  it("hides the payment column when the sheet does not track payment", () => {
    const ids = visibleVatRegisterColumns([], false).map((column) => column.id);
    expect(ids).not.toContain("status");
    expect(ids).toContain("bill");
  });

  it("shows every available column when the saved selection would hide them all", () => {
    const ids = visibleVatRegisterColumns(
      VAT_REGISTER_COLUMNS.map((column) => column.id),
      true
    ).map((column) => column.id);
    expect(ids).toEqual(VAT_REGISTER_COLUMNS.map((column) => column.id));
  });

  it("aligns footer totals under the money columns", () => {
    expect(
      vatRegisterFooterPieces(["index", "date", "before", "vat", "after", "docs"])
    ).toEqual([
      { type: "label", span: 2 },
      { type: "money", id: "before" },
      { type: "money", id: "vat" },
      { type: "money", id: "after" },
      { type: "gap", span: 1 },
    ]);
  });

  it("omits the label cell when every leading column is hidden", () => {
    expect(vatRegisterFooterPieces(["vat", "docs"])).toEqual([
      { type: "money", id: "vat" },
      { type: "gap", span: 1 },
    ]);
  });
});
