import type { BiProductSalesBranchRow } from "@/lib/bi/product-sales-types";
import {
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  labelFor,
  shareOf,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: BiProductSalesBranchRow[];
};

export default function ProductSalesBranchTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.revenue_net - a.revenue_net);
  const revenueTotal = sorted.reduce((s, r) => s + r.revenue_net, 0);
  const qtyTotal = sorted.reduce((s, r) => s + r.base_qty, 0);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          ตามสาขา (HQ / SYP / ออนไลน์)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มียอดขายในช่วงนี้
          </p>
        ) : (
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">สาขา</th>
                <th className="py-2 pr-3 text-right font-medium">ยอดขาย</th>
                <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                <th className="py-2 pr-3 text-right font-medium">ต้นทุนขาย</th>
                <th className="py-2 text-right font-medium">ขั้นต้น</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-slate-900">
                      {labelFor(BRANCH_LABELS, row.key)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCount(row.bill_count)} บิล ·{" "}
                      {shareOf(row.revenue_net, revenueTotal).toFixed(0)}%
                      ยอดขาย
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.revenue_net)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatCount(row.base_qty)}
                    <div className="text-xs text-muted-foreground">
                      {shareOf(row.base_qty, qtyTotal).toFixed(0)}%
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.cogs)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {formatBaht(row.gross_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
