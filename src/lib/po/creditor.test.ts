import { describe, expect, it } from "vitest";

import {
  creditorHasPurchaseVat,
  creditorIdentity,
  purchaseVatIsBlank,
  purchaseVatNote,
} from "@/lib/po/creditor";

describe("creditor identity", () => {
  it("keeps a full name and the code together", () => {
    expect(
      creditorIdentity({
        code: "KCY",
        name: "เค ซี วาย จักรกล (กิตเจริญยนต์)",
      })
    ).toEqual({
      code: "KCY",
      name: "เค ซี วาย จักรกล (กิตเจริญยนต์)",
    });
  });

  it("uses the master name when the bill only stored the code", () => {
    expect(
      creditorIdentity({
        code: "CRRF",
        name: "CRRF",
        masterName: "บริษัท ซี.อาร์.อาร์.โปรดักท์ จำกัด (ชัยรุ่งเรือง ฟอร์ด)",
      })
    ).toEqual({
      code: "CRRF",
      name: "บริษัท ซี.อาร์.อาร์.โปรดักท์ จำกัด (ชัยรุ่งเรือง ฟอร์ด)",
    });
  });

  it("uses the master name when the bill name is blank", () => {
    expect(
      creditorIdentity({
        code: "THL",
        name: "  ",
        masterName: "ตั้งเฮงล้ง",
      })
    ).toEqual({ code: "THL", name: "ตั้งเฮงล้ง" });
  });
});

describe("purchase VAT on creditor codes", () => {
  it("treats only codes starting with 7 as purchase VAT", () => {
    expect(creditorHasPurchaseVat("7WFC")).toBe(true);
    expect(creditorHasPurchaseVat("CRRF")).toBe(false);
    expect(creditorHasPurchaseVat(null)).toBe(false);
  });

  it("accepts 0 and blank as no purchase VAT", () => {
    expect(purchaseVatIsBlank("0")).toBe(true);
    expect(purchaseVatIsBlank("0.0")).toBe(true);
    expect(purchaseVatIsBlank("")).toBe(true);
    expect(purchaseVatIsBlank(null)).toBe(true);
    expect(purchaseVatIsBlank("420.00")).toBe(false);
  });

  it("explains that a non-7 code can be left at zero", () => {
    expect(purchaseVatNote("CRRF", "0")).toBe("ไม่มีภาษีซื้อ — ใส่ 0 หรือเว้นว่างได้");
    expect(purchaseVatNote("CRRF", null)).toBe("ไม่มีภาษีซื้อ — ใส่ 0 หรือเว้นว่างได้");
    expect(purchaseVatNote("CRRF", "420")).toBe("รหัสไม่ขึ้นต้นด้วย 7 แต่ใบนี้มียอดภาษี");
    expect(purchaseVatNote("7WFC", "420")).toBeNull();
  });
});
