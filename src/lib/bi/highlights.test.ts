import { describe, expect, it } from "vitest";

import {
  buildCashflowHighlights,
  buildCustomerHighlights,
  buildExpenseHighlights,
  buildIncomeHighlights,
  buildIncomeStatementHighlights,
  buildProductHighlights,
  buildSalesHighlights,
  buildVatHighlights,
} from "./highlights";
import type { BiCashflowOverview } from "./cashflow-types";
import type { BiCustomerOverview } from "./customer-types";
import type { BiExpenseOverview } from "./expense-types";
import type { BiIncomeOverview } from "./income-types";
import type { BiIncomeStatementOverview } from "./income-statement-types";
import type { BiProductOverview } from "./product-types";
import type { BiSalesOverview } from "./sales-types";
import type { BiVatOverview } from "./vat-types";

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
          name_source: "party",
          bill_acctname: "ICE",
          in_party: true,
          in_armas: true,
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
    expect(lines.some((l) => l.includes("party"))).toBe(true);
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

  it("builds income highlight lines with gross and net", () => {
    const incomeBase: BiIncomeOverview = {
      from: "2026-07-01",
      to: "2026-07-25",
      branch: null,
      previous_from: "2026-06-06",
      previous_to: "2026-06-30",
      summary: {
        revenue_net: 6_500_000,
        cogs: 4_800_000,
        gross_profit: 1_700_000,
        gross_margin_pct: 26.15,
        opex: 500_000,
        net_income: 1_200_000,
        net_margin_pct: 18.46,
        bill_count: 1200,
        line_count: 14000,
        blank_cost_line_count: 67,
      },
      previous_summary: {
        revenue_net: 6_000_000,
        cogs: 4_500_000,
        gross_profit: 1_500_000,
        gross_margin_pct: 25,
        opex: 480_000,
        net_income: 1_020_000,
        net_margin_pct: 17,
      },
      by_branch: [
        {
          key: "HQ",
          revenue_net: 5_000_000,
          cogs: 3_700_000,
          gross_profit: 1_300_000,
          opex: 350_000,
          net_income: 950_000,
          bill_count: 900,
        },
      ],
      opex_by_category: [],
      trend_daily: [],
      trend_monthly: [],
    };

    const lines = buildIncomeHighlights(incomeBase);
    expect(lines[0]).toContain("กำไรขั้นต้น");
    expect(lines[1]).toContain("กำไรสุทธิ");
    expect(lines.some((l) => l.includes("HQ"))).toBe(true);
    expect(lines.some((l) => l.includes("ตัดออกจากคำนวณ") || l.includes("ไม่มีต้นทุน"))).toBe(
      true
    );
  });
});

describe("buildIncomeStatementHighlights", () => {
  it("summarizes profit, CIT, and forecast", () => {
    const base: BiIncomeStatementOverview = {
      from: "2026-01-01",
      to: "2026-12-31",
      branch: null,
      previous_from: "2025-01-01",
      previous_to: "2025-12-31",
      as_of: "2026-08-08",
      cit_rate: 0.2,
      summary: {
        revenue: 10_000_000,
        purchase_cost: 4_000_000,
        expense: 1_000_000,
        total_cost: 5_000_000,
        profit_before_tax: 5_000_000,
        profit_margin_pct: 50,
        income_tax: 1_000_000,
        cit_rate: 0.2,
        net_profit: 4_000_000,
        net_margin_pct: 40,
        sales_bill_count: 100,
        purchase_bill_count: 40,
        expense_bill_count: 10,
      },
      previous_summary: {
        revenue: 9_000_000,
        purchase_cost: 3_800_000,
        expense: 900_000,
        total_cost: 4_700_000,
        profit_before_tax: 4_300_000,
        profit_margin_pct: 47.8,
        income_tax: 860_000,
        cit_rate: 0.2,
        net_profit: 3_440_000,
        net_margin_pct: 38.2,
        sales_bill_count: 90,
        purchase_bill_count: 38,
        expense_bill_count: 9,
      },
      forecast: {
        enabled: true,
        as_of: "2026-08-08",
        days_elapsed: 220,
        days_in_range: 365,
        factor: 1.66,
        revenue: 16_600_000,
        purchase_cost: 6_640_000,
        expense: 1_660_000,
        total_cost: 8_300_000,
        profit_before_tax: 8_300_000,
        income_tax: 1_660_000,
        net_profit: 6_640_000,
      },
      by_branch: [
        {
          key: "HQ",
          revenue: 7_000_000,
          purchase_cost: 4_000_000,
          expense: 700_000,
          total_cost: 4_700_000,
          profit_before_tax: 2_300_000,
          income_tax: 460_000,
          net_profit: 1_840_000,
        },
      ],
      trend_daily: [],
      trend_monthly: [],
    };

    const lines = buildIncomeStatementHighlights(base);
    expect(lines[0]).toContain("กำไรก่อนภาษี");
    expect(lines[1]).toContain("ภาษีเงินได้");
    expect(lines.some((l) => l.includes("พยากรณ์"))).toBe(true);
    expect(lines.some((l) => l.includes("HQ") || l.includes("สำนักงาน"))).toBe(
      true
    );
  });
});

describe("buildVatHighlights", () => {
  it("summarizes net VAT and forecast when enabled", () => {
    const vatBase: BiVatOverview = {
      from: "2026-08-01",
      to: "2026-08-31",
      branch: null,
      previous_from: "2026-07-01",
      previous_to: "2026-07-31",
      as_of: "2026-08-05",
      summary: {
        sales_before: 1_000_000,
        sales_vat: 70_000,
        sales_bill_count: 100,
        purchase_before: 500_000,
        purchase_vat: 35_000,
        purchase_bill_count: 40,
        expense_before: 100_000,
        expense_vat: 7_000,
        expense_bill_count: 10,
        net_vat: 28_000,
      },
      previous_summary: {
        sales_before: 900_000,
        sales_vat: 63_000,
        sales_bill_count: 90,
        purchase_before: 480_000,
        purchase_vat: 33_600,
        purchase_bill_count: 38,
        expense_before: 90_000,
        expense_vat: 6_300,
        expense_bill_count: 9,
        net_vat: 23_100,
      },
      forecast: {
        enabled: true,
        as_of: "2026-08-05",
        days_elapsed: 5,
        days_in_range: 31,
        factor: 6.2,
        sales_vat: 434_000,
        purchase_vat: 217_000,
        expense_vat: 43_400,
        net_vat: 173_600,
        sales_before: 6_200_000,
        purchase_before: 3_100_000,
        expense_before: 620_000,
      },
      by_sales_doc: [
        {
          key: "TAR",
          branch: "HQ",
          bill_count: 50,
          beforetax: 600_000,
          tax: 42_000,
          aftertax: 642_000,
        },
      ],
      by_purchase_book: [],
      by_expense_doc: [],
      by_branch: [],
      trend_daily: [],
      trend_monthly: [],
    };

    const lines = buildVatHighlights(vatBase);
    expect(lines[0]).toContain("ภาษีขาย");
    expect(lines[1]).toContain("สุทธิ");
    expect(lines.some((l) => l.includes("พยากรณ์"))).toBe(true);
    expect(lines.some((l) => l.includes("TAR"))).toBe(true);
  });
});

describe("buildCashflowHighlights", () => {
  it("builds cashflow highlight lines from bank statement overview", () => {
    const cashflowBase: BiCashflowOverview = {
      from: "2026-07-01",
      to: "2026-07-31",
      account_no: null,
      include_ignored: true,
      limit: 30,
      previous_from: "2026-06-01",
      previous_to: "2026-06-30",
      summary: {
        inflow: 1_000_000,
        outflow: 800_000,
        net: 200_000,
        line_count: 120,
        inflow_count: 50,
        outflow_count: 70,
        internal_in: 100_000,
        internal_out: 90_000,
        net_ex_internal: 190_000,
        unclassified_count: 12,
        opening_balance: 500_000,
        ending_balance: 700_000,
        account_count: 6,
      },
      previous_summary: {
        inflow: 900_000,
        outflow: 850_000,
        net: 50_000,
        line_count: 100,
        net_ex_internal: 40_000,
      },
      report: {
        opening_cash: 500_000,
        sales_in: 300_000,
        ar_in: 600_000,
        supplier_out: 400_000,
        payroll_out: 0,
        opex_out: 0,
        ending_cash: 700_000,
        forecast_30d: 720_000,
        forecast_daily_net: 666,
        other_in: 0,
        other_out: 0,
        other_count: 12,
        lines: [],
      },
      by_account: [],
      by_category: [
        {
          key: "tar_cntar_net",
          label: "รับชำระลูกหนี้",
          inflow: 600_000,
          outflow: 0,
          net: 600_000,
          line_count: 10,
        },
        {
          key: "pvmas",
          label: "จ่ายเจ้าหนี้ (PVMAS)",
          inflow: 0,
          outflow: 400_000,
          net: -400_000,
          line_count: 20,
        },
      ],
      by_match_status: [],
      trend_daily: [],
      trend_monthly: [],
      top_inflows: [],
      top_outflows: [],
      accounts: [],
      month_columns: [],
      report_by_month: [],
    };

    const lines = buildCashflowHighlights(cashflowBase);
    expect(lines[0]).toContain("เงินเข้า");
    expect(lines[0]).toContain("สุทธิ");
    expect(lines.some((l) => l.includes("คงเหลือรวม"))).toBe(true);
    expect(lines.some((l) => l.includes("โอนระหว่างบัญชี"))).toBe(true);
    expect(lines.some((l) => l.includes("รับชำระลูกหนี้"))).toBe(true);
    expect(lines.some((l) => l.includes("จ่ายเจ้าหนี้"))).toBe(true);
    expect(lines.some((l) => l.includes("ยังไม่จับคู่หมวด"))).toBe(true);
  });
});
