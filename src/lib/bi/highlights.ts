import type { BiProductOverview } from "./product-types";
import {
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  formatPct,
  labelFor,
  pctChange,
  SALES_TYPE_LABELS,
  shareOf,
} from "./sales-format";
import {
  formatThaiPeriodLabel,
  inclusiveDayCount,
} from "./sales-periods";
import type { BiSalesOverview, BiSplitRow, BiTrendRow } from "./sales-types";

function topSplit(rows: BiSplitRow[]): BiSplitRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.revenue_net - a.revenue_net)[0] ?? null;
}

function changePhrase(delta: number | null): string {
  if (delta == null) return "เทียบช่วงก่อนไม่ได้";
  if (Math.abs(delta) < 0.05) return "ทรงตัวเทียบช่วงก่อน";
  return delta > 0
    ? `เพิ่มขึ้น ${formatPct(delta)} เทียบช่วงก่อน`
    : `ลดลง ${formatPct(Math.abs(delta))} เทียบช่วงก่อน`;
}

function bestTrendRow(rows: BiTrendRow[]): BiTrendRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.revenue_net - a.revenue_net)[0] ?? null;
}

export function buildSalesHighlights(overview: BiSalesOverview): string[] {
  const lines: string[] = [];
  const total = overview.summary.revenue_net;
  const revenueDelta = pctChange(
    overview.summary.revenue_net,
    overview.previous_summary.revenue_net
  );
  const dayCount = inclusiveDayCount(overview.from, overview.to);

  lines.push(
    `ยอดขายสุทธิ ${formatBaht(total)} (${changePhrase(revenueDelta)}) · ${formatCount(overview.summary.bill_count)} บิล · เฉลี่ย ${formatBaht(overview.summary.avg_bill)}/บิล`
  );

  const topBranch = topSplit(overview.by_branch);
  if (topBranch) {
    const branchTotal = overview.by_branch.reduce(
      (sum, r) => sum + r.revenue_net,
      0
    );
    const parts = overview.by_branch
      .slice()
      .sort((a, b) => b.revenue_net - a.revenue_net)
      .map(
        (r) =>
          `${labelFor(BRANCH_LABELS, r.key)} ${shareOf(r.revenue_net, branchTotal).toFixed(0)}%`
      )
      .join(" · ");
    lines.push(
      `${labelFor(BRANCH_LABELS, topBranch.key)} นำที่ ${shareOf(topBranch.revenue_net, branchTotal).toFixed(0)}% ของยอด (${parts})`
    );
  }

  const topSalesType = topSplit(overview.by_sales_type);
  if (topSalesType) {
    const typeTotal = overview.by_sales_type.reduce(
      (sum, r) => sum + r.revenue_net,
      0
    );
    const vat = overview.by_sales_type.find((r) => r.key === "VAT");
    const nonVat = overview.by_sales_type.find((r) => r.key === "NON_VAT");
    lines.push(
      `${labelFor(SALES_TYPE_LABELS, topSalesType.key)} นำที่ ${shareOf(topSalesType.revenue_net, typeTotal).toFixed(0)}% · VAT ${formatBaht(vat?.revenue_net ?? 0)} · Non-VAT ${formatBaht(nonVat?.revenue_net ?? 0)}`
    );
  }

  if (dayCount > 1) {
    const avgBills = overview.summary.bill_count / dayCount;
    lines.push(
      `ช่วง ${formatCount(dayCount)} วัน · เฉลี่ย ${avgBills.toLocaleString("th-TH", { maximumFractionDigits: 1 })} บิล/วัน`
    );
  }

  const daily = overview.trend_daily;
  if (daily.length > 1) {
    const best = bestTrendRow(daily);
    if (best) {
      lines.push(
        `วันที่มียอดสูงสุด ${formatThaiPeriodLabel(best.period, "daily")} · ${formatBaht(best.revenue_net)} (${formatCount(best.bill_count)} บิล)`
      );
    }
  } else if (overview.trend_monthly.length > 1) {
    const best = bestTrendRow(overview.trend_monthly);
    if (best) {
      lines.push(
        `เดือนที่มียอดสูงสุด ${formatThaiPeriodLabel(best.period, "monthly")} · ${formatBaht(best.revenue_net)} (${formatCount(best.bill_count)} บิล)`
      );
    }
  }

  return lines;
}

export function buildProductHighlights(overview: BiProductOverview): string[] {
  const lines: string[] = [];
  const total = overview.summary.revenue_net;
  const revenueDelta = pctChange(
    overview.summary.revenue_net,
    overview.previous_summary.revenue_net
  );
  const skuDelta = pctChange(
    overview.summary.sku_count,
    overview.previous_summary.sku_count
  );

  lines.push(
    `ยอดขายสุทธิระดับสินค้า ${formatBaht(total)} (${changePhrase(revenueDelta)}) · ${formatCount(overview.summary.sku_count)} SKU (${changePhrase(skuDelta)}) · ขาย ${formatCount(overview.summary.base_qty)} หน่วยเล็ก`
  );

  const topProduct = overview.top_products[0];
  if (topProduct) {
    const detail =
      topProduct.detail.length > 40
        ? `${topProduct.detail.slice(0, 40)}…`
        : topProduct.detail;
    lines.push(
      `สินค้าอันดับ 1: ${topProduct.bcode} (${detail}) · ${formatBaht(topProduct.revenue_net)} · ${shareOf(topProduct.revenue_net, total).toFixed(1)}% ของยอด`
    );
  }

  const topCategory = [...overview.by_category].sort(
    (a, b) => b.revenue_net - a.revenue_net
  )[0];
  if (topCategory) {
    lines.push(
      `หมวดนำ: ${topCategory.key} ${topCategory.label} · ${formatBaht(topCategory.revenue_net)} · ${shareOf(topCategory.revenue_net, total).toFixed(0)}% · ${formatCount(topCategory.sku_count)} SKU`
    );
  }

  const topCode1 = [...overview.by_code1]
    .filter((r) => r.key !== "OTHER")
    .sort((a, b) => b.revenue_net - a.revenue_net)[0];
  if (topCode1) {
    lines.push(
      `ชนิดชิ้นส่วนนำ (CODE1): ${topCode1.key} ${topCode1.label} · ${formatBaht(topCode1.revenue_net)} · ${shareOf(topCode1.revenue_net, total).toFixed(0)}%`
    );
  }

  return lines;
}
