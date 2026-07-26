"use client";

import { useMemo, useState } from "react";

import type { BiExpenseItemRow } from "@/lib/bi/expense-types";
import { formatBaht, formatCount, shareOf } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ExpenseItemTableProps = {
  rows: BiExpenseItemRow[];
  totalAmount: number;
};

export default function ExpenseItemTable({
  rows,
  totalAmount,
}: ExpenseItemTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.label, row.category_name].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">
            อันดับประเภทค่าใช้จ่าย
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            ตามยอดหลัง VAT/หัก ณ ที่จ่ายและส่วนลดบิล (สูตรเดียวกับภาพรวมค่าใช้จ่าย)
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาประเภท / หมวด…"
          className="w-full sm:max-w-xs"
          aria-label="ค้นหาประเภทค่าใช้จ่าย"
        />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">ประเภท</th>
              <th className="py-2 pr-3 font-medium">หมวด</th>
              <th className="py-2 pr-3 text-right font-medium">ยอดรวม</th>
              <th className="py-2 pr-3 text-right font-medium">บริษัท</th>
              <th className="py-2 pr-3 text-right font-medium">ทั่วไป</th>
              <th className="py-2 pr-3 text-right font-medium">รายการ</th>
              <th className="py-2 text-right font-medium">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={row.key}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="whitespace-nowrap py-2.5 pr-2 text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="max-w-[14rem] py-2.5 pr-3 font-medium text-slate-900">
                    {row.label}
                  </td>
                  <td className="max-w-[12rem] truncate py-2.5 pr-3 text-xs text-slate-700">
                    {row.category_name || "—"}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums font-medium">
                    {formatBaht(row.amount)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatBaht(row.entries_amount)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatBaht(row.general_amount)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatCount(row.line_count)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-muted-foreground">
                    {shareOf(row.amount, totalAmount).toFixed(1)}%
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
