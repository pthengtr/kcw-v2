"use client";

import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import type { ProductSalesCompareRow } from "@/lib/bi/product-sales-compare";
import { colorForSkuIndex } from "@/lib/bi/product-sales-compare";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatMarginPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

type Props = {
  rows: ProductSalesCompareRow[];
  focusedBcode: string | null;
  onFocus: (bcode: string) => void;
};

export default function ProductSalesCompareTable({
  rows,
  focusedBcode,
  onFocus,
}: Props) {
  const sorted = [...rows].sort((a, b) => b.revenue_net - a.revenue_net);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          เทียบสินค้าที่เลือก
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          คลิกแถวเพื่อดูกราฟราคา ประวัติซื้อ/ขาย และมาร์จิ้นของ SKU นั้น · HQ /
          SYP / ออนไลน์ เป็นจำนวนชิ้น
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูล
          </p>
        ) : (
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">สินค้า</th>
                <th className="py-2 pr-3 text-right font-medium">ยอดขาย</th>
                <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                <th className="py-2 pr-3 text-right font-medium">ขั้นต้น</th>
                <th className="py-2 pr-3 text-right font-medium">มาร์จิ้น</th>
                <th className="py-2 pr-3 text-right font-medium">HQ</th>
                <th className="py-2 pr-3 text-right font-medium">SYP</th>
                <th className="py-2 pr-3 text-right font-medium">ออนไลน์</th>
                <th className="py-2 text-right font-medium">ซื้อเข้า</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const selected = row.bcode === focusedBcode;
                const colorIndex = rows.findIndex((r) => r.bcode === row.bcode);
                return (
                  <tr
                    key={row.bcode}
                    className={cn(
                      "cursor-pointer border-b border-slate-100",
                      selected
                        ? "bg-teal-50/80"
                        : "hover:bg-slate-50"
                    )}
                    onClick={() => onFocus(row.bcode)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onFocus(row.bcode);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selected}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: colorForSkuIndex(colorIndex) }}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">
                            {row.bcode}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.detail}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatBaht(row.revenue_net)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatCount(row.base_qty)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatBaht(row.gross_profit)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatMarginPct(row.gross_margin_pct)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {formatCount(row.hq_qty)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {formatCount(row.syp_qty)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {formatCount(row.online_qty)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatCount(row.buy_qty)}
                      <div className="text-xs">
                        {formatBaht(row.buy_amount_net)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
