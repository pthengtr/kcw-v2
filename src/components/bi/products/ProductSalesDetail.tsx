"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Boxes, Package, Percent, ShoppingCart, Wallet } from "lucide-react";

import { buildProductSalesHighlights } from "@/lib/bi/highlights";
import { isBranchMixPieApplicable } from "@/lib/bi/product-sales-chart";
import type { BiProductSalesOverview } from "@/lib/bi/product-sales-types";
import {
  formatBaht,
  formatBahtCompact,
  formatCount,
  pctChange,
} from "@/lib/bi/sales-format";
import { preferDailyBreakdown } from "@/lib/bi/sales-periods";
import type { BiBranchFilter } from "@/lib/bi/sales-types";
import BiHighlightsCard from "@/components/bi/BiHighlightsCard";
import BiLoadingBody from "@/components/bi/BiLoadingBody";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import { Card, CardContent } from "@/components/ui/card";

import ProductSalesBranchPie from "./ProductSalesBranchPie";
import ProductSalesBranchTable from "./ProductSalesBranchTable";
import ProductSalesHistoryTables from "./ProductSalesHistoryTables";
import ProductSalesPeriodTable from "./ProductSalesPeriodTable";
import ProductSalesPriceChart from "./ProductSalesPriceChart";
import ProductSalesTrendChart from "./ProductSalesTrendChart";

function formatMarginPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

type Props = {
  overview: BiProductSalesOverview;
  loading?: boolean;
  branchFilter: BiBranchFilter;
};

export default function ProductSalesDetail({
  overview,
  loading = false,
  branchFilter,
}: Props) {
  const product = overview.product;
  const useDaily = preferDailyBreakdown(overview.from, overview.to);
  const trendRows = useDaily ? overview.trend_daily : overview.trend_monthly;
  const revenueDelta = pctChange(
    overview.summary.revenue_net,
    overview.previous_summary.revenue_net
  );
  const qtyDelta = pctChange(
    overview.summary.base_qty,
    overview.previous_summary.base_qty
  );
  const gpDelta = pctChange(
    overview.summary.gross_profit,
    overview.previous_summary.gross_profit
  );
  const highlightLines = useMemo(
    () => buildProductSalesHighlights(overview),
    [overview]
  );
  const showBranchPie = isBranchMixPieApplicable(
    overview.branch ?? branchFilter,
    overview.by_branch
  );

  return (
    <BiLoadingBody loading={loading}>
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">สินค้า</p>
            <p className="font-semibold text-slate-900">{product.bcode}</p>
            <p className="text-sm text-slate-700">{product.detail}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">หมวด / ชนิด</p>
            <p className="text-sm text-slate-800">
              <Link
                href={`/bi/products?category=${encodeURIComponent(product.category_code)}`}
                className="hover:underline"
              >
                {product.category_code} {product.category_name}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {product.code1_name
                ? `${product.code1} · ${product.code1_name}`
                : "—"}
              {" · "}
              <Link
                href={`/bi/products?category=${encodeURIComponent(product.category_code)}`}
                className="text-teal-800 hover:underline"
              >
                ดูอันดับทั้งหมวด
              </Link>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ยี่ห้อ / รุ่น</p>
            <p className="text-sm text-slate-800">
              {[product.brand, product.model].filter(Boolean).join(" · ") ||
                "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              เบอร์แท้ {product.mcode || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">สต็อก / ต้นทุนล่าสุด</p>
            <p className="text-sm text-slate-800">
              คงเหลือ {formatCount(product.on_hand_qty)} · COSTLAST{" "}
              {product.costlast == null
                ? "—"
                : formatBaht(product.costlast, true)}
            </p>
            <p className="text-xs text-muted-foreground">
              ขายล่าสุด {product.last_sale_date || "—"} · ซื้อล่าสุด{" "}
              {product.last_purchase_date || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SalesKpiCard
          title="ยอดขายสุทธิ"
          value={formatBahtCompact(overview.summary.revenue_net)}
          deltaPct={revenueDelta}
          hint="ระดับบรรทัด · ก่อน VAT"
          icon={<Wallet className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="จำนวนขาย"
          value={formatCount(overview.summary.base_qty)}
          deltaPct={qtyDelta}
          hint={`${formatCount(overview.summary.bill_count)} บิล · เฉลี่ย ${formatBaht(overview.summary.avg_unit_price, true)}/หน่วย`}
          icon={<Boxes className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="กำไรขั้นต้น"
          value={formatBahtCompact(overview.summary.gross_profit)}
          deltaPct={gpDelta}
          hint="ยอดที่มี LAST_PURCHASE_COST − ต้นทุนขาย"
          icon={<Percent className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="อัตรากำไรขั้นต้น"
          value={formatMarginPct(overview.summary.gross_margin_pct)}
          hint={
            overview.summary.blank_cost_line_count > 0
              ? `ตัด ${formatCount(overview.summary.blank_cost_line_count)} บรรทัดไม่มีต้นทุน`
              : "คิดจากบรรทัดที่มีต้นทุนซื้อล่าสุด"
          }
          icon={<Percent className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="ซื้อเข้าช่วงนี้"
          value={formatCount(overview.purchase.buy_qty)}
          hint={`${formatBaht(overview.purchase.buy_amount_net)} · ${formatCount(overview.purchase.buy_bills)} บิล HQ — ไม่ใช่ COGS`}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="คงเหลือ HQ"
          value={formatCount(product.on_hand_qty)}
          hint="QTYOH2 จาก ICMAS ณ ตอนซิงก์ล่าสุด"
          icon={<Package className="h-4 w-4" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ProductSalesTrendChart
          title={useDaily ? "แนวโน้มรายวันตามสาขา" : "แนวโน้มรายเดือนตามสาขา"}
          rows={trendRows}
          mode={useDaily ? "daily" : "monthly"}
        />
        {showBranchPie ? (
          <ProductSalesBranchPie rows={overview.by_branch} />
        ) : (
          <ProductSalesBranchTable rows={overview.by_branch} />
        )}
      </section>

      <section>
        <ProductSalesPriceChart
          title={
            useDaily ? "ราคาขาย vs ต้นทุนรายวัน" : "ราคาขาย vs ต้นทุนรายเดือน"
          }
          rows={trendRows}
          purchases={overview.purchase_history}
          mode={useDaily ? "daily" : "monthly"}
        />
      </section>

      {showBranchPie ? (
        <section>
          <ProductSalesBranchTable rows={overview.by_branch} />
        </section>
      ) : null}

      <section>
        <ProductSalesPeriodTable
          rows={trendRows}
          mode={useDaily ? "daily" : "monthly"}
        />
      </section>

      <section>
        <ProductSalesHistoryTables
          sales={overview.sales_history}
          purchases={overview.purchase_history}
        />
      </section>

      <section>
        <BiHighlightsCard lines={highlightLines} />
      </section>
    </BiLoadingBody>
  );
}
