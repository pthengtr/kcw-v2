"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatBaht, shareOf } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#4f46e5", "#be123c", "#15803d"];

type ExpenseGroupRow = {
  key: string;
  label: string;
  amount: number;
};

type ExpenseGroupChartProps = {
  title: string;
  rows: ExpenseGroupRow[];
  maxSlices?: number;
  emptyLabel?: string;
};

export default function ExpenseGroupChart({
  title,
  rows,
  maxSlices = 8,
  emptyLabel = "ไม่มีข้อมูล",
}: ExpenseGroupChartProps) {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const head = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const otherAmount = rest.reduce((sum, r) => sum + r.amount, 0);
  const chartRows =
    otherAmount !== 0
      ? [
          ...head,
          {
            key: "__other__",
            label: `อื่นๆ (${rest.length})`,
            amount: otherAmount,
          },
        ]
      : head;

  const total = chartRows.reduce((sum, r) => sum + r.amount, 0);
  const data = chartRows
    .filter((r) => r.amount !== 0)
    .map((r) => ({
      key: r.key,
      name: r.label,
      value: r.amount,
      share: shareOf(r.amount, total),
    }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,12rem)]">
            <div className="mx-auto h-48 w-full max-w-[14rem] min-w-0 sm:h-52 sm:max-w-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const n =
                        typeof value === "number" ? value : Number(value);
                      return [formatBaht(n), "ยอด"];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-xs">
              {data.map((row, index) => (
                <li
                  key={row.key}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate text-slate-700">{row.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {row.share.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
