"use client";

import type { BiIncomeOpexCategoryRow } from "@/lib/bi/income-types";
import { formatBaht, shareOf } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IncomeOpexTableProps = {
  rows: BiIncomeOpexCategoryRow[];
  totalOpex: number;
};

export default function IncomeOpexTable({
  rows,
  totalOpex,
}: IncomeOpexTableProps) {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 12);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          ค่าใช้จ่ายตามหมวด
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีค่าใช้จ่ายในช่วงนี้
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sorted.map((row) => (
              <li
                key={row.key}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-slate-800">
                  {row.label || row.key}
                </span>
                <span className="shrink-0 tabular-nums text-slate-900">
                  {formatBaht(row.amount)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {shareOf(row.amount, totalOpex).toFixed(0)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
