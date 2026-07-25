import {
  formatBaht,
  formatCount,
  shareOf,
} from "@/lib/bi/sales-format";
import { formatThaiPeriodLabel } from "@/lib/bi/sales-periods";
import type { BiTrendRow } from "@/lib/bi/sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SalesPeriodTableProps = {
  rows: BiTrendRow[];
  mode: "daily" | "monthly";
};

export default function SalesPeriodTable({
  rows,
  mode,
}: SalesPeriodTableProps) {
  const total = rows.reduce((sum, r) => sum + r.revenue_net, 0);
  const title =
    mode === "daily" ? "แยกตามวัน" : "แยกตามเดือน";

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">
                {mode === "daily" ? "วันที่" : "เดือน"}
              </th>
              <th className="py-2 pr-3 text-right font-medium">ยอดสุทธิ</th>
              <th className="py-2 pr-3 text-right font-medium">สัดส่วน</th>
              <th className="py-2 text-right font-medium">บิล</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.period}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-slate-800">
                    {formatThaiPeriodLabel(row.period, mode)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.revenue_net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {shareOf(row.revenue_net, total).toFixed(1)}%
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                    {formatCount(row.bill_count)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t text-sm font-medium text-slate-900">
                <td className="py-2.5 pr-3">รวม</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {formatBaht(total)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                  100%
                </td>
                <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                  {formatCount(
                    rows.reduce((sum, r) => sum + r.bill_count, 0)
                  )}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </CardContent>
    </Card>
  );
}
