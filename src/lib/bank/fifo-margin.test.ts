import { describe, expect, it } from "vitest";

import {
  briefFifoMargin,
  fifoMargin,
  fifoMarginText,
  fifoSiteForBillnos,
  mergeBillFifo,
  parseBillFifoRows,
  piBillRefs,
  saleBillTakesFifo,
  type BillFifoCost,
} from "@/lib/bank/fifo-margin";

function cost(overrides: Partial<BillFifoCost> & Pick<BillFifoCost, "billno">): BillFifoCost {
  return {
    site: "hq",
    fifo_ext_cost: 40,
    units: 1,
    line_count: 1,
    uncosted_lines: 0,
    partial_lines: 0,
    status: "OK",
    pi_bills: [{ pi_billno: "PI1", pi_billdate: "2026-01-02", qty: 1, ext_cost: 40 }],
    ...overrides,
  };
}

describe("fifoMargin", () => {
  it("subtracts FIFO cost from the matched amount and keeps the PI bill", () => {
    const margin = fifoMargin({
      revenue: 100,
      billnos: ["TAD1"],
      costs: [cost({ billno: "TAD1" })],
    });
    expect(margin).toMatchObject({
      revenue: 100,
      fifo_ext_cost: 40,
      profit: 60,
      margin_pct: 60,
      status: "OK",
      costed_bills: 1,
      expected_bills: 1,
    });
    expect(margin.pi_bills.map((bill) => bill.pi_billno)).toEqual(["PI1"]);
  });

  it("counts a sale bill once when the match lists it twice", () => {
    const margin = fifoMargin({
      revenue: 100,
      billnos: ["TAD1", "TAD1"],
      costs: [cost({ billno: "TAD1", fifo_ext_cost: 25 })],
    });
    expect(margin.fifo_ext_cost).toBe(25);
    expect(margin.expected_bills).toBe(1);
    expect(margin.profit).toBe(75);
  });

  it("marks the margin partial when one bill has no FIFO row", () => {
    const margin = fifoMargin({
      revenue: 200,
      billnos: ["TR1", "TR2"],
      costs: [cost({ billno: "TR1", fifo_ext_cost: 50 })],
    });
    expect(margin.status).toBe("PARTIAL");
    expect(margin.costed_bills).toBe(1);
    expect(margin.profit).toBe(150);
  });

  it("stays missing when none of the sale bills were costed", () => {
    const margin = fifoMargin({
      revenue: 80,
      billnos: ["TR9"],
      costs: [],
    });
    expect(margin.status).toBe("MISSING");
    expect(margin.fifo_ext_cost).toBe(0);
    expect(fifoMarginText(margin)).toBe("ยังไม่มีต้นทุน FIFO");
  });

  it("does not treat an uncosted bill as pure profit", () => {
    const margin = fifoMargin({
      revenue: 80,
      billnos: ["TR1"],
      costs: [cost({ billno: "TR1", fifo_ext_cost: 0, status: "UNCOSTED", pi_bills: [] })],
    });
    expect(margin.status).toBe("UNCOSTED");
    expect(fifoMarginText(margin)).toBe("ยังคิดต้นทุน FIFO ไม่ได้");
  });

  it("leaves the rate empty when the matched amount is zero", () => {
    const margin = fifoMargin({
      revenue: 0,
      billnos: ["TR1"],
      costs: [cost({ billno: "TR1", fifo_ext_cost: 10 })],
    });
    expect(margin.margin_pct).toBeNull();
    expect(margin.profit).toBe(-10);
  });
});

describe("parseBillFifoRows", () => {
  it("merges the same bill from two sites and the same PI bill", () => {
    const rows = parseBillFifoRows([
      {
        billno: "TR1",
        site: "hq",
        fifo_ext_cost: 10,
        units: 1,
        line_count: 1,
        uncosted_lines: 0,
        partial_lines: 0,
        status: "OK",
        pi_bills: [{ pi_billno: "PI1", pi_billdate: "2026-02-01", qty: 1, ext_cost: 10 }],
      },
      {
        billno: "TR1",
        site: "syp",
        fifo_ext_cost: 5,
        units: 1,
        line_count: 1,
        uncosted_lines: 1,
        partial_lines: 0,
        status: "UNCOSTED",
        pi_bills: [{ pi_billno: "PI1", pi_billdate: "2026-02-01", qty: 2, ext_cost: 5 }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fifo_ext_cost: 15,
      status: "UNCOSTED",
      line_count: 2,
    });
    expect(rows[0].pi_bills).toEqual([
      { pi_billno: "PI1", pi_billdate: "2026-02-01", qty: 3, ext_cost: 15 },
    ]);
  });

  it("combines already parsed rows", () => {
    const merged = mergeBillFifo([
      cost({ billno: "A", fifo_ext_cost: 1, pi_bills: [] }),
      cost({ billno: "A", fifo_ext_cost: 2, status: "PARTIAL", pi_bills: [] }),
    ]);
    expect(merged[0].fifo_ext_cost).toBe(3);
    expect(merged[0].status).toBe("PARTIAL");
  });
});

describe("fifo helpers", () => {
  it("picks one site from the bill series", () => {
    expect(fifoSiteForBillnos(["TAR6905-1", "TR1"])).toBe("hq");
    expect(fifoSiteForBillnos(["3TAR6905-1"])).toBe("syp");
    expect(fifoSiteForBillnos(["TR1", "3TR1"])).toBeNull();
  });

  it("skips credit notes", () => {
    expect(saleBillTakesFifo("CNTAR6905-1")).toBe(false);
    expect(saleBillTakesFifo("3CNTAR1", "3CNTAR")).toBe(false);
    expect(saleBillTakesFifo("TAD6905-1", "TAD")).toBe(true);
    expect(saleBillTakesFifo("3TR1")).toBe(true);
  });

  it("shortens the PI bill list and the row label", () => {
    const margin = fifoMargin({
      revenue: 100,
      billnos: ["TAD1"],
      costs: [
        cost({
          billno: "TAD1",
          pi_bills: [
            { pi_billno: "PI1", pi_billdate: "2026-01-01", qty: 1, ext_cost: 20 },
            { pi_billno: "PI2", pi_billdate: "2026-01-02", qty: 1, ext_cost: 20 },
          ],
        }),
      ],
    });
    expect(piBillRefs(margin.pi_bills)).toBe("PI1, PI2");
    expect(fifoMarginText(margin)).toBe("ต้นทุน FIFO 40.00 · กำไร 60.00 (60.0%)");
    expect(briefFifoMargin(margin).pi_bill_count).toBe(2);
  });
});
