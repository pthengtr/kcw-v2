"use client";

import type { BiCashflowAccountRow } from "@/lib/bi/cashflow-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CashFlowAccountTableProps = {
  rows: BiCashflowAccountRow[];
};

export default function CashFlowAccountTable({
  rows,
}: CashFlowAccountTableProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          แยกตามบัญชีธนาคาร
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          ยอดเข้า–ออกในช่วงที่เลือก · ยอดคงเหลือ ณ สิ้นช่วง
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">บัญชี</th>
              <th className="py-2 pr-3 text-right font-medium">เงินเข้า</th>
              <th className="py-2 pr-3 text-right font-medium">เงินออก</th>
              <th className="py-2 pr-3 text-right font-medium">สุทธิ</th>
              <th className="py-2 pr-3 text-right font-medium">รายการ</th>
              <th className="py-2 text-right font-medium">คงเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
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
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-slate-900">{row.label}</div>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-teal-800">
                    {formatBaht(row.inflow)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-rose-800">
                    {formatBaht(row.outflow)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap py-2.5 pr-3 text-right tabular-nums font-medium",
                      row.net >= 0 ? "text-emerald-800" : "text-rose-800"
                    )}
                  >
                    {formatBaht(row.net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-600">
                    {formatCount(row.line_count)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums font-medium text-slate-900">
                    {formatBaht(row.ending_balance)}
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
