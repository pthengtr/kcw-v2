import { shareOf } from "./sales-format";
import type { BiProductSalesOverview } from "./product-sales-types";

export const PRODUCT_SALES_SINGLE_HISTORY_LIMIT = 40;
export const PRODUCT_SALES_COMPARE_HISTORY_LIMIT = 20;

export const SKU_COMPARE_COLORS = [
  "#0f766e",
  "#0369a1",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#15803d",
  "#c2410c",
  "#1d4ed8",
  "#a21caf",
  "#0e7490",
  "#4d7c0f",
  "#9a3412",
] as const;

export function colorForSkuIndex(index: number): string {
  return SKU_COMPARE_COLORS[index % SKU_COMPARE_COLORS.length] ?? "#64748b";
}

export type ProductSalesCompareRow = {
  bcode: string;
  detail: string;
  category_code: string;
  category_name: string;
  revenue_net: number;
  base_qty: number;
  gross_profit: number;
  gross_margin_pct: number | null;
  hq_revenue_net: number;
  syp_revenue_net: number;
  online_revenue_net: number;
  buy_qty: number;
  buy_amount_net: number;
  on_hand_qty: number;
};

export type ProductSalesCompareTotals = {
  skuCount: number;
  soldSkuCount: number;
  revenue_net: number;
  previous_revenue_net: number;
  base_qty: number;
  previous_base_qty: number;
  gross_profit: number;
  previous_gross_profit: number;
  cogs: number;
  costed_revenue_net: number;
  gross_margin_pct: number | null;
  blank_cost_line_count: number;
  buy_qty: number;
  buy_amount_net: number;
  buy_bills: number;
  on_hand_qty: number;
};

function branchRevenue(
  report: BiProductSalesOverview,
  key: string
): number {
  return report.by_branch.find((row) => row.key === key)?.revenue_net ?? 0;
}

export function toCompareRow(
  report: BiProductSalesOverview
): ProductSalesCompareRow {
  return {
    bcode: report.product.bcode,
    detail: report.product.detail,
    category_code: report.product.category_code,
    category_name: report.product.category_name,
    revenue_net: report.summary.revenue_net,
    base_qty: report.summary.base_qty,
    gross_profit: report.summary.gross_profit,
    gross_margin_pct: report.summary.gross_margin_pct,
    hq_revenue_net: branchRevenue(report, "HQ"),
    syp_revenue_net: branchRevenue(report, "SYP"),
    online_revenue_net: branchRevenue(report, "ONLINE"),
    buy_qty: report.purchase.buy_qty,
    buy_amount_net: report.purchase.buy_amount_net,
    on_hand_qty: report.product.on_hand_qty,
  };
}

export function summarizeProductSalesReports(
  reports: BiProductSalesOverview[]
): ProductSalesCompareTotals {
  const revenue_net = reports.reduce(
    (sum, row) => sum + row.summary.revenue_net,
    0
  );
  const previous_revenue_net = reports.reduce(
    (sum, row) => sum + row.previous_summary.revenue_net,
    0
  );
  const base_qty = reports.reduce((sum, row) => sum + row.summary.base_qty, 0);
  const previous_base_qty = reports.reduce(
    (sum, row) => sum + row.previous_summary.base_qty,
    0
  );
  const gross_profit = reports.reduce(
    (sum, row) => sum + row.summary.gross_profit,
    0
  );
  const previous_gross_profit = reports.reduce(
    (sum, row) => sum + row.previous_summary.gross_profit,
    0
  );
  const cogs = reports.reduce((sum, row) => sum + row.summary.cogs, 0);
  const costed_revenue_net = reports.reduce(
    (sum, row) => sum + row.summary.costed_revenue_net,
    0
  );

  return {
    skuCount: reports.length,
    soldSkuCount: reports.filter((row) => row.summary.revenue_net !== 0)
      .length,
    revenue_net,
    previous_revenue_net,
    base_qty,
    previous_base_qty,
    gross_profit,
    previous_gross_profit,
    cogs,
    costed_revenue_net,
    gross_margin_pct:
      costed_revenue_net > 0 ? (gross_profit / costed_revenue_net) * 100 : null,
    blank_cost_line_count: reports.reduce(
      (sum, row) => sum + row.summary.blank_cost_line_count,
      0
    ),
    buy_qty: reports.reduce((sum, row) => sum + row.purchase.buy_qty, 0),
    buy_amount_net: reports.reduce(
      (sum, row) => sum + row.purchase.buy_amount_net,
      0
    ),
    buy_bills: reports.reduce((sum, row) => sum + row.purchase.buy_bills, 0),
    on_hand_qty: reports.reduce(
      (sum, row) => sum + row.product.on_hand_qty,
      0
    ),
  };
}

export function pickFocusedBcode(
  reports: BiProductSalesOverview[],
  preferred: string | null
): string | null {
  if (
    preferred &&
    reports.some(
      (row) => row.bcode === preferred || row.product.bcode === preferred
    )
  ) {
    return preferred;
  }
  const ranked = [...reports].sort(
    (a, b) => b.summary.revenue_net - a.summary.revenue_net
  );
  return ranked[0]?.product.bcode ?? null;
}

export function buildCompareRevenueSeries(
  reports: BiProductSalesOverview[],
  mode: "daily" | "monthly"
): Record<string, string | number>[] {
  const keys = new Set<string>();
  for (const report of reports) {
    const rows = mode === "daily" ? report.trend_daily : report.trend_monthly;
    for (const row of rows) keys.add(row.period);
  }
  const periods = [...keys].sort();
  return periods.map((period) => {
    const point: Record<string, string | number> = { period };
    for (const report of reports) {
      const rows =
        mode === "daily" ? report.trend_daily : report.trend_monthly;
      point[report.product.bcode] =
        rows.find((row) => row.period === period)?.revenue_net ?? 0;
    }
    return point;
  });
}

export type SkuMixSlice = {
  key: string;
  name: string;
  value: number;
  qty: number;
  share: number;
};

export function skuMixSlices(rows: ProductSalesCompareRow[]): SkuMixSlice[] {
  const total = rows.reduce((sum, row) => sum + row.revenue_net, 0);
  return [...rows]
    .filter((row) => row.revenue_net !== 0)
    .sort((a, b) => b.revenue_net - a.revenue_net)
    .map((row) => ({
      key: row.bcode,
      name: row.detail ? `${row.bcode} · ${row.detail}` : row.bcode,
      value: row.revenue_net,
      qty: row.base_qty,
      share: shareOf(row.revenue_net, total),
    }));
}
