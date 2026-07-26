import type { BiCustomerOverview } from "./customer-types";
import type { BiExpenseOverview } from "./expense-types";
import type { BiIncomeOverview } from "./income-types";
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

export function buildCustomerHighlights(overview: BiCustomerOverview): string[] {
  const lines: string[] = [];
  const total = overview.summary.revenue_net;
  const revenueDelta = pctChange(
    overview.summary.revenue_net,
    overview.previous_summary.revenue_net
  );
  const customerDelta = pctChange(
    overview.summary.customer_count,
    overview.previous_summary.customer_count
  );

  lines.push(
    `ยอดลูกค้าที่จัดอันดับ ${formatBaht(total)} (${changePhrase(revenueDelta)}) · ${formatCount(overview.summary.customer_count)} รหัส (${changePhrase(customerDelta)}) · ${formatCount(overview.summary.bill_count)} บิล`
  );

  const top = overview.top_customers[0];
  if (top) {
    const name =
      top.customer_name.length > 36
        ? `${top.customer_name.slice(0, 36)}…`
        : top.customer_name;
    lines.push(
      `ลูกค้าอันดับ 1: ${top.acctno} (${name}) · ${formatBaht(top.revenue_net)} · ${shareOf(top.revenue_net, total).toFixed(1)}% ของยอดจัดอันดับ`
    );
  }

  if (overview.summary.unmatched_customer_count > 0) {
    lines.push(
      `รอ sync เข้า party: ${formatCount(overview.summary.unmatched_customer_count)} รหัส · มีใน party แล้ว ${formatCount(overview.summary.matched_customer_count)} รหัส`
    );
  } else if (overview.summary.customer_count > 0) {
    lines.push("ทุกรหัสในช่วงนี้มีใน party master แล้ว");
  }

  if (overview.walkin_summary.bill_count > 0) {
    lines.push(
      `ตัด walk-in (ไม่มี ACCTNO): ${formatCount(overview.walkin_summary.bill_count)} บิล · ${formatBaht(overview.walkin_summary.revenue_net)}`
    );
  }

  return lines;
}

export function buildExpenseHighlights(overview: BiExpenseOverview): string[] {
  const lines: string[] = [];
  const total = overview.summary.amount;
  const amountDelta = pctChange(
    overview.summary.amount,
    overview.previous_summary.amount
  );

  lines.push(
    `ยอดค่าใช้จ่าย ${formatBaht(total)} (${changePhrase(amountDelta)}) · บริษัท ${formatBaht(overview.summary.entries_amount)} · ทั่วไป ${formatBaht(overview.summary.general_amount)}`
  );

  const topItem = overview.top_items[0];
  if (topItem) {
    lines.push(
      `ประเภทนำ: ${topItem.label} · ${formatBaht(topItem.amount)} · ${shareOf(topItem.amount, total).toFixed(1)}%`
    );
  }

  const topCategory = [...overview.by_category].sort(
    (a, b) => b.amount - a.amount
  )[0];
  if (topCategory) {
    lines.push(
      `หมวดนำ: ${topCategory.label} · ${formatBaht(topCategory.amount)} · ${shareOf(topCategory.amount, total).toFixed(0)}% · ${formatCount(topCategory.item_count)} ประเภท`
    );
  }

  const topBranch = [...overview.by_branch].sort(
    (a, b) => b.amount - a.amount
  )[0];
  if (topBranch) {
    lines.push(
      `สาขานำ: ${topBranch.label || topBranch.key} · ${formatBaht(topBranch.amount)} · ${shareOf(topBranch.amount, total).toFixed(0)}%`
    );
  }

  return lines;
}

export function buildIncomeHighlights(overview: BiIncomeOverview): string[] {
  const lines: string[] = [];
  const grossDelta = pctChange(
    overview.summary.gross_profit,
    overview.previous_summary.gross_profit
  );
  const netDelta = pctChange(
    overview.summary.net_income,
    overview.previous_summary.net_income
  );

  const grossPct =
    overview.summary.gross_margin_pct != null
      ? `${overview.summary.gross_margin_pct.toFixed(1)}%`
      : "—";
  const netPct =
    overview.summary.net_margin_pct != null
      ? `${overview.summary.net_margin_pct.toFixed(1)}%`
      : "—";

  lines.push(
    `กำไรขั้นต้น ${formatBaht(overview.summary.gross_profit)} (${grossPct} ของยอด · ${changePhrase(grossDelta)}) · ต้นทุน ${formatBaht(overview.summary.cogs)}`
  );
  lines.push(
    `กำไรสุทธิ (ประมาณ) ${formatBaht(overview.summary.net_income)} (${netPct} · ${changePhrase(netDelta)}) หลังหักค่าใช้จ่าย ${formatBaht(overview.summary.opex)}`
  );

  const topBranch = [...overview.by_branch].sort(
    (a, b) => b.net_income - a.net_income
  )[0];
  if (topBranch) {
    lines.push(
      `สาขานำด้านสุทธิ: ${labelFor(BRANCH_LABELS, topBranch.key)} · ${formatBaht(topBranch.net_income)} · ขั้นต้น ${formatBaht(topBranch.gross_profit)}`
    );
  }

  if (overview.summary.blank_cost_line_count > 0) {
    lines.push(
      `บรรทัดที่ไม่มีต้นทุนซื้อล่าสุด: ${formatCount(overview.summary.blank_cost_line_count)} แถว (นับต้นทุน = 0)`
    );
  }

  return lines;
}
