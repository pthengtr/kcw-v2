import { describe, expect, it } from "vitest";

import {
  buildCustomerHighlights,
  buildExpenseHighlights,
  buildProductHighlights,
  buildSalesHighlights,
} from "./highlights";
import type { BiCustomerOverview } from "./customer-types";
import type { BiExpenseOverview } from "./expense-types";
import type { BiProductOverview } from "./product-types";
import type { BiSalesOverview } from "./sales-types";

const salesBase: BiSalesOverview = {
  from: "2026-07-01",
  to: "2026-07-25",
  branch: null,
  previous_from: "2026-06-06",
  previous_to: "2026-06-30",
  summary: {
    revenue_net: 6_560_000,
    vat_baht: 100_000,
    bill_count: 5600,
    avg_bill: 1171,
  },
  previous_summary: {
    revenue_net: 7_160_000,
    vat_baht: 96_000,
    bill_count: 5700,
  },
  by_sales_type: [
    { key: "NON_VAT", revenue_net: 5_100_000, bill_count: 4800 },
    { key: "VAT", revenue_net: 1_460_000, bill_count: 800 },
  ],
  by_branch: [
    { key: "HQ", revenue_net: 4_400_000, bill_count: 3500 },
    { key: "SYP", revenue_net: 1_400_000, bill_count: 1500 },
    { key: "ONLINE", revenue_net: 760_000, bill_count: 600 },
  ],
  by_channel: [],
  by_billtype: [],
  trend_daily: [
    { period: "2026-07-01", revenue_net: 200_000, bill_count: 180, hq_revenue_net: 0, syp_revenue_net: 0, online_revenue_net: 0 },
    { period: "2026-07-18", revenue_net: 400_000, bill_count: 250, hq_revenue_net: 0, syp_revenue_net: 0, online_revenue_net: 0 },
  ],
  trend_monthly: [
    { period: "2026-07", revenue_net: 6_560_000, bill_count: 5600, hq_revenue_net: 0, syp_revenue_net: 0, online_revenue_net: 0 },
  ],
};

const productBase: BiProductOverview = {
  from: "2026-07-01",
  to: "2026-07-25",
  branch: null,
  limit: 50,
  previous_from: "2026-06-06",
  previous_to: "2026-06-30",
  summary: {
    revenue_net: 6_560_000,
    base_qty: 24000,
    sku_count: 4500,
    line_count: 12000,
    bill_count: 12000,
  },
  previous_summary: {
    revenue_net: 7_000_000,
    base_qty: 25000,
    sku_count: 4300,
  },
  by_category: [
    {
      key: "21",
      label: "แบตเตอรี่ น้ำกรด น้ำกลั่น",
      revenue_net: 900_000,
      base_qty: 1000,
      sku_count: 120,
    },
    {
      key: "15",
      label: "ลูกปืน",
      revenue_net: 500_000,
      base_qty: 800,
      sku_count: 200,
    },
  ],
  by_code1: [
    {
      key: "C",
      label: "ซีล",
      revenue_net: 400_000,
      base_qty: 500,
      sku_count: 80,
    },
    {
      key: "OTHER",
      label: "อื่นๆ / ไม่ระบุ",
      revenue_net: 5_000_000,
      base_qty: 20000,
      sku_count: 4000,
    },
  ],
  by_branch: [],
  top_products: [
    {
      bcode: "21050289",
      detail: "แบตเตอรี่ FB เติมน้ำจากบริษัท",
      category_code: "21",
      category_name: "แบตเตอรี่ น้ำกรด น้ำกลั่น",
      code1: null,
      code1_name: null,
      revenue_net: 155_000,
      base_qty: 60,
      line_count: 56,
      bill_count: 56,
      hq_revenue_net: 130_000,
      syp_revenue_net: 25_000,
      online_revenue_net: 0,
      on_hand_qty: 37,
      pcode: null,
      mcode: "1031026306",
      brand: "FB",
    },
  ],
};

describe("BI highlight builders", () => {
  it("builds sales highlight lines from overview facts", () => {
    const lines = buildSalesHighlights(salesBase);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain("ยอดขายสุทธิ");
    expect(lines[0]).toContain("ลดลง");
    expect(lines.some((l) => l.includes("HQ นำที่"))).toBe(true);
    expect(lines.some((l) => l.includes("Non-VAT นำที่"))).toBe(true);
    expect(lines.some((l) => l.includes("บิล/วัน"))).toBe(true);
    expect(lines.some((l) => /18\s*ก\.ค\./.test(l))).toBe(true);
  });

  it("omits bills-per-day for single-day sales ranges", () => {
    const lines = buildSalesHighlights({
      ...salesBase,
      from: "2026-07-18",
      to: "2026-07-18",
      trend_daily: [
        {
          period: "2026-07-18",
          revenue_net: 400_000,
          bill_count: 250,
          hq_revenue_net: 0,
          syp_revenue_net: 0,
          online_revenue_net: 0,
        },
      ],
    });
    expect(lines.some((l) => l.includes("บิล/วัน"))).toBe(false);
  });

  it("builds product highlight lines with top SKU and category", () => {
    const lines = buildProductHighlights(productBase);
    expect(lines[0]).toContain("ยอดขายสุทธิระดับสินค้า");
    expect(lines.some((l) => l.includes("21050289"))).toBe(true);
    expect(lines.some((l) => l.includes("หมวดนำ: 21"))).toBe(true);
    expect(lines.some((l) => l.includes("CODE1") && l.includes("ซีล"))).toBe(
      true
    );
    expect(lines.some((l) => l.includes("OTHER"))).toBe(false);
  });

  it("builds customer highlight lines with top acct and walk-in note", () => {
    const customerBase: BiCustomerOverview = {
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      limit: 50,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 3_200_000,
        customer_count: 280,
        bill_count: 2100,
        avg_bill: 1523,
        matched_customer_count: 195,
        unmatched_customer_count: 85,
      },
      walkin_summary: {
        revenue_net: 3_300_000,
        bill_count: 3400,
      },
      previous_summary: {
        revenue_net: 3_000_000,
        customer_count: 260,
        bill_count: 2000,
      },
      by_branch: [],
      top_customers: [
        {
          acctno: "7ICE",
          customer_name: "ICE TIKTOK SHOP",
          bill_acctname: "ICE",
          in_party: true,
          party_kind: "CUSTOMER",
          revenue_net: 120_000,
          bill_count: 40,
          avg_bill: 3000,
          hq_revenue_net: 0,
          syp_revenue_net: 0,
          online_revenue_net: 120_000,
        },
      ],
      unmatched_customers: [],
    };

    const lines = buildCustomerHighlights(customerBase);
    expect(lines[0]).toContain("ยอดลูกค้าที่จัดอันดับ");
    expect(lines.some((l) => l.includes("7ICE"))).toBe(true);
    expect(lines.some((l) => l.includes("รอ sync"))).toBe(true);
    expect(lines.some((l) => l.includes("walk-in"))).toBe(true);
  });

  it("builds expense highlight lines with company/general split", () => {
    const expenseBase: BiExpenseOverview = {
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      source: null,
      limit: 30,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        amount: 500_000,
        line_count: 120,
        item_count: 18,
        receipt_count: 40,
        general_count: 80,
        entries_amount: 300_000,
        general_amount: 200_000,
      },
      previous_summary: {
        amount: 450_000,
        line_count: 110,
        item_count: 16,
      },
      by_source: [],
      by_branch: [
        {
          key: "hq",
          label: "สำนักงานใหญ่",
          amount: 400_000,
          line_count: 100,
        },
      ],
      by_category: [
        {
          key: "c1",
          label: "สาธารณูปโภค",
          amount: 120_000,
          item_count: 4,
          line_count: 20,
        },
      ],
      top_items: [
        {
          key: "i1",
          label: "ค่าไฟ",
          category_name: "สาธารณูปโภค",
          amount: 80_000,
          line_count: 5,
          entries_amount: 70_000,
          general_amount: 10_000,
        },
      ],
      trend_monthly: [],
      month_columns: [],
      by_item_month: [],
      branches: [],
    };

    const lines = buildExpenseHighlights(expenseBase);
    expect(lines[0]).toContain("ยอดค่าใช้จ่าย");
    expect(lines[0]).toContain("บริษัท");
    expect(lines.some((l) => l.includes("ค่าไฟ"))).toBe(true);
    expect(lines.some((l) => l.includes("สาธารณูปโภค"))).toBe(true);
    expect(lines.some((l) => l.includes("สำนักงานใหญ่"))).toBe(true);
  });
});
