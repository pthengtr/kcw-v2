"use client";

import type { BiCashflowLineRow } from "@/lib/bi/cashflow-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CashFlowLineTableProps = {
  title: string;
  rows: BiCashflowLineRow[];
  tone?: "in" | "out";
};

export default function CashFlowLineTable({
  title,
  rows,
  tone = "in",
}: CashFlowLineTableProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">วันที่</th>
              <th className="py-2 pr-3 font-medium">รายละเอียด</th>
              <th className="py-2 pr-3 font-medium">หมวด</th>
              <th className="py-2 pr-3 font-medium">บัญชี</th>
              <th className="py-2 text-right font-medium">ยอด</th>
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
                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                    {row.txn_date}
                  </td>
                  <td className="max-w-[14rem] truncate py-2.5 pr-3 text-slate-900">
                    {row.label}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                    {row.category_label}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                    {row.account_no}
                  </td>
                  <td
                    className={
                      tone === "in"
                        ? "whitespace-nowrap py-2.5 text-right tabular-nums font-medium text-teal-800"
                        : "whitespace-nowrap py-2.5 text-right tabular-nums font-medium text-rose-800"
                    }
                  >
                    {formatBaht(row.amount)}
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
