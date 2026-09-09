"use client";

import type { BiExpenseCategoryRow } from "@/lib/bi/expense-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: BiExpenseCategoryRow[];
};

export default function ExpenseCategorySplitTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">ค่าใช้จ่ายตามหมวด</CardTitle>
        <p className="text-xs text-muted-foreground">
          สุทธิ = บริษัท + ทั่วไป + หักส่วนตัว
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">หมวด</th>
              <th className="py-2 pr-3 text-right font-medium">บริษัท</th>
              <th className="py-2 pr-3 text-right font-medium">ทั่วไป</th>
              <th className="py-2 pr-3 text-right font-medium">หักส่วนตัว</th>
              <th className="py-2 text-right font-medium">สุทธิ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="max-w-[12rem] truncate py-2.5 pr-3 font-medium">
                    {row.label}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {formatCount(row.item_count)} ประเภท
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.entries_amount)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.general_amount)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-rose-700">
                    {formatBaht(row.offset_amount)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums font-medium">
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
