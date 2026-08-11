"use client";

import { useMemo, useState } from "react";

import type { BiMonthCompareRow } from "@/lib/bi/month-compare";
import { formatBaht } from "@/lib/bi/sales-format";
import { formatThaiPeriodLabel } from "@/lib/bi/sales-periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type RankMonthCompareTableProps = {
  title: string;
  description: string;
  rowHeader: string;
  searchPlaceholder: string;
  monthColumns: string[];
  rows: BiMonthCompareRow[];
};

const compactBaht = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCell(amount: number): string {
  if (!amount) return "—";
  if (Math.abs(amount) >= 10_000) return compactBaht.format(amount);
  return formatBaht(amount);
}

export default function RankMonthCompareTable({
  title,
  description,
  rowHeader,
  searchPlaceholder,
  monthColumns,
  rows,
}: RankMonthCompareTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.key, row.label, row.sublabel ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const period of monthColumns) {
      totals[period] = filtered.reduce(
        (sum, row) => sum + (row.months[period] ?? 0),
        0
      );
    }
    return totals;
  }, [filtered, monthColumns]);

  const grandTotal = useMemo(
    () => filtered.reduce((sum, row) => sum + row.total, 0),
    [filtered]
  );

  const monthLabels = monthColumns.map((period) => ({
    period,
    label: formatThaiPeriodLabel(period, "monthly"),
    short: period.slice(5),
  }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full sm:max-w-xs"
          aria-label="ค้นหาในตารางรายเดือน"
        />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {monthColumns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลรายเดือน
          </p>
        ) : (
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-medium">
                  {rowHeader}
                </th>
                {monthLabels.map((m) => (
                  <th
                    key={m.period}
                    className="px-2 py-2 text-right font-medium"
                    title={m.label}
                  >
                    {m.short}
                  </th>
                ))}
                <th className="py-2 pl-2 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={monthColumns.length + 2}
                    className="py-8 text-center text-muted-foreground"
                  >
                    ไม่มีข้อมูล
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="sticky left-0 z-10 max-w-[14rem] bg-white py-2 pr-3">
                        <span className="block truncate font-medium text-slate-900">
                          {row.label}
                        </span>
                        {row.sublabel ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.sublabel}
                          </span>
                        ) : null}
                      </td>
                      {monthColumns.map((period) => (
                        <td
                          key={period}
                          className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700"
                        >
                          {formatCell(row.months[period] ?? 0)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums font-medium">
                        {formatBaht(row.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-slate-50/80 font-medium">
                    <td className="sticky left-0 z-10 bg-slate-50 py-2.5 pr-3">
                      รวมทั้งหมด
                    </td>
                    {monthColumns.map((period) => (
                      <td
                        key={period}
                        className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums"
                      >
                        {formatCell(columnTotals[period] ?? 0)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap py-2.5 pl-2 text-right tabular-nums">
                      {formatBaht(grandTotal)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
