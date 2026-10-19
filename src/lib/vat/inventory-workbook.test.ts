import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildVatInventoryWorkbook } from "@/lib/vat/inventory-workbook";
import type { VatInventoryExport } from "@/lib/vat/inventory";

describe("vat inventory workbook", () => {
  it("writes remaining stock and the transaction cost and sale price", () => {
    const data: VatInventoryExport = {
      layers: [],
      products: [
        {
          bcode: "A1",
          descr: "bolt",
          qty: 4,
          value: 20,
          uncovered_qty: 0,
          open_qty: 0,
          purchase_qty: 10,
          rv_qty: 0,
          sale_qty: 6,
          tar_qty: 0,
          sa_qty: 0,
          tf_qty: 0,
          actual_qty: 4,
          site: "hq",
        },
      ],
      movements: [
        {
          bcode: "A1",
          descr: "bolt",
          billdate: "2026-03-15",
          billno: "TR1",
          kind: "SALE",
          site: "hq",
          qty: -6,
          unit_cost: 5,
          sale_price: 12.5,
          cost_billno: "PI-OLD",
          balance: 4,
          supplier: "",
        },
      ],
    };

    const book = XLSX.read(buildVatInventoryWorkbook(data), { type: "buffer" });
    const products = XLSX.utils.sheet_to_json<(string | number)[]>(book.Sheets["คงเหลือ"], {
      header: 1,
    });
    const movements = XLSX.utils.sheet_to_json<(string | number)[]>(
      book.Sheets["ความเคลื่อนไหว"],
      { header: 1 }
    );

    expect(book.SheetNames).toEqual(["คงเหลือ", "ความเคลื่อนไหว"]);
    expect(products[1]?.[5]).toBe(-6);
    expect(movements[0]).toContain("ทุนซื้อ");
    expect(movements[0]).toContain("บิลซื้อ");
    expect(movements[0]).toContain("ราคาขาย");
    expect(movements[1]?.[2]).toBe("2026-03-15");
    expect(movements[1]?.[4]).toBe("ขาย VAT");
    expect(movements[1]?.[8]).toBe(5);
    expect(movements[1]?.[9]).toBe("PI-OLD");
    expect(movements[1]?.[10]).toBe(12.5);
  });
});
