import {
  BILLTYPE_LABELS,
  formatBaht,
  formatCount,
  labelFor,
  shareOf,
} from "@/lib/bi/sales-format";
import type { BiSplitRow } from "@/lib/bi/sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SalesBilltypeTableProps = {
  rows: BiSplitRow[];
};

export default function SalesBilltypeTable({ rows }: SalesBilltypeTableProps) {
  const total = rows.reduce((sum, r) => sum + r.revenue_net, 0);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          แยกตามประเภทเอกสาร
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">ประเภท</th>
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
                <tr key={row.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">
                    {labelFor(BILLTYPE_LABELS, row.key)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.revenue_net)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {shareOf(row.revenue_net, total).toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatCount(row.bill_count)}
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
