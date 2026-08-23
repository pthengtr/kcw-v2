import {
  formatBaht,
  formatCount,
  shareOf,
} from "@/lib/bi/sales-format";
import { formatThaiPeriodLabel } from "@/lib/bi/sales-periods";
import type { BiProductSalesTrendRow } from "@/lib/bi/product-sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: BiProductSalesTrendRow[];
  mode: "daily" | "monthly";
};

function sumField(
  rows: BiProductSalesTrendRow[],
  key: keyof Pick<
    BiProductSalesTrendRow,
    | "revenue_net"
    | "base_qty"
    | "bill_count"
    | "hq_qty"
    | "syp_qty"
    | "online_qty"
    | "cogs"
    | "gross_profit"
  >
): number {
  return rows.reduce((sum, r) => sum + r[key], 0);
}

export default function ProductSalesPeriodTable({ rows, mode }: Props) {
  const total = sumField(rows, "revenue_net");
  const title = mode === "daily" ? "แยกตามวัน" : "แยกตามเดือน";

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          รวมทุกสาขา + แยก HQ / SYP / ออนไลน์ เป็นจำนวนชิ้น · จำนวนเป็นหน่วยเล็ก
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">
                {mode === "daily" ? "วันที่" : "เดือน"}
              </th>
              <th className="py-2 pr-3 text-right font-medium">ยอดสุทธิ</th>
              <th className="py-2 pr-3 text-right font-medium">HQ</th>
              <th className="py-2 pr-3 text-right font-medium">SYP</th>
              <th className="py-2 pr-3 text-right font-medium">ออนไลน์</th>
              <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
              <th className="py-2 pr-3 text-right font-medium">ขาย/หน่วย</th>
              <th className="py-2 pr-3 text-right font-medium">ต้นทุน/หน่วย</th>
              <th className="py-2 pr-3 text-right font-medium">ขั้นต้น</th>
              <th className="py-2 text-right font-medium">บิล</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
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
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatCount(row.hq_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatCount(row.syp_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatCount(row.online_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatCount(row.base_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {row.base_qty === 0
                      ? "—"
                      : formatBaht(row.revenue_net / row.base_qty, true)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {row.base_qty === 0
                      ? "—"
                      : formatBaht(row.cogs / row.base_qty, true)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.gross_profit)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                    {formatCount(row.bill_count)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {shareOf(row.revenue_net, total).toFixed(0)}%
                    </span>
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
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {formatCount(sumField(rows, "hq_qty"))}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {formatCount(sumField(rows, "syp_qty"))}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {formatCount(sumField(rows, "online_qty"))}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {formatCount(sumField(rows, "base_qty"))}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {sumField(rows, "base_qty") === 0
                    ? "—"
                    : formatBaht(total / sumField(rows, "base_qty"), true)}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {sumField(rows, "base_qty") === 0
                    ? "—"
                    : formatBaht(
                        sumField(rows, "cogs") / sumField(rows, "base_qty"),
                        true
                      )}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {formatBaht(sumField(rows, "gross_profit"))}
                </td>
                <td className="whitespace-nowrap py-2.5 text-right tabular-nums">
                  {formatCount(sumField(rows, "bill_count"))}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </CardContent>
    </Card>
  );
}
