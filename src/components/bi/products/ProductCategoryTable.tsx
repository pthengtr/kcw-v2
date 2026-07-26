import type { BiProductGroupRow } from "@/lib/bi/product-types";
import {
  formatBaht,
  formatCount,
  shareOf,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProductCategoryTableProps = {
  rows: BiProductGroupRow[];
  title?: string;
};

export default function ProductCategoryTable({
  rows,
  title = "แยกตามหมวดสินค้า",
}: ProductCategoryTableProps) {
  const total = rows.reduce((sum, r) => sum + r.revenue_net, 0);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">หมวด</th>
              <th className="py-2 pr-3 text-right font-medium">ยอดสุทธิ</th>
              <th className="py-2 pr-3 text-right font-medium">SKU</th>
              <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
              <th className="py-2 text-right font-medium">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="max-w-[16rem] py-2.5 pr-3">
                    <span className="block whitespace-nowrap text-xs text-slate-500">
                      {row.key}
                    </span>
                    <span className="block truncate font-medium text-slate-800">
                      {row.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.revenue_net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatCount(row.sku_count)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatCount(row.base_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-muted-foreground">
                    {shareOf(row.revenue_net, total).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
