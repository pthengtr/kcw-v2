import type {
  BiProductPurchaseHistoryRow,
  BiProductSalesBranchRow,
  BiProductSalesPricePoint,
  BiProductSalesTrendRow,
} from "./product-sales-types";

export function purchasePeriodKey(
  billDate: string,
  mode: "daily" | "monthly"
): string {
  const day = billDate.slice(0, 10);
  if (mode === "monthly") return day.slice(0, 7);
  return day;
}

function avgOrNull(numer: number, denom: number): number | null {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom === 0) {
    return null;
  }
  return numer / denom;
}

/** Margin % on costed lines: GP / (GP + COGS). */
export function marginPctFromGpAndCogs(
  grossProfit: number,
  cogs: number
): number | null {
  const costedRevenue = grossProfit + cogs;
  if (!Number.isFinite(costedRevenue) || costedRevenue === 0) return null;
  return (grossProfit / costedRevenue) * 100;
}

export function isBranchMixPieApplicable(
  branchFilter: string | null | undefined,
  rows: Pick<BiProductSalesBranchRow, "revenue_net">[]
): boolean {
  if (branchFilter && branchFilter !== "ALL") return false;
  return rows.filter((r) => r.revenue_net !== 0).length >= 2;
}

function emptyPoint(period: string): BiProductSalesPricePoint {
  return {
    period,
    avg_sale: null,
    avg_cost: null,
    margin_pct: null,
    avg_buy: null,
    buy_qty: 0,
  };
}

/**
 * Unit sale price vs LAST_PURCHASE_COST (COGS) over the trend,
 * with HQ PIDET buy price overlaid on days/months that have purchases.
 */
export function buildProductSalesPriceSeries(
  trend: BiProductSalesTrendRow[],
  purchases: BiProductPurchaseHistoryRow[],
  mode: "daily" | "monthly"
): BiProductSalesPricePoint[] {
  const byPeriod = new Map<string, BiProductSalesPricePoint>();

  for (const row of trend) {
    byPeriod.set(row.period, {
      period: row.period,
      avg_sale: avgOrNull(row.revenue_net, row.base_qty),
      avg_cost: avgOrNull(row.cogs, row.base_qty),
      margin_pct: marginPctFromGpAndCogs(row.gross_profit, row.cogs),
      avg_buy: null,
      buy_qty: 0,
    });
  }

  const buyQty = new Map<string, number>();
  const buyAmount = new Map<string, number>();
  for (const buy of purchases) {
    const period = purchasePeriodKey(buy.bill_date, mode);
    if (!period) continue;
    buyQty.set(period, (buyQty.get(period) ?? 0) + buy.base_qty);
    buyAmount.set(period, (buyAmount.get(period) ?? 0) + buy.amount_net);
  }

  for (const [period, qty] of buyQty) {
    const existing = byPeriod.get(period) ?? emptyPoint(period);
    existing.buy_qty = qty;
    existing.avg_buy = avgOrNull(buyAmount.get(period) ?? 0, qty);
    byPeriod.set(period, existing);
  }

  return [...byPeriod.values()].sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0
  );
}
