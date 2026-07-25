"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatBaht, formatCount, shareOf } from "@/lib/bi/sales-format";
import type { BiSplitRow } from "@/lib/bi/sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#4f46e5", "#be123c"];

type SalesSplitChartProps = {
  title: string;
  rows: BiSplitRow[];
  labels: Record<string, string>;
  emptyLabel?: string;
};

export default function SalesSplitChart({
  title,
  rows,
  labels,
  emptyLabel = "ไม่มีข้อมูล",
}: SalesSplitChartProps) {
  const total = rows.reduce((sum, r) => sum + r.revenue_net, 0);
  const data = rows
    .filter((r) => r.revenue_net !== 0 || r.bill_count > 0)
    .map((r) => ({
      key: r.key,
      name: labels[r.key] ?? r.key,
      value: r.revenue_net,
      bills: r.bill_count,
      share: shareOf(r.revenue_net, total),
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
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,11rem)]">
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
                    {data.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatBaht(
                        typeof value === "number" ? value : Number(value)
                      )
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2.5 text-sm">
              {data.map((row, i) => (
                <li key={row.key} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {row.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      <span className="whitespace-nowrap">
                        {formatBaht(row.value)}
                      </span>
                      <span className="mx-1.5 text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="whitespace-nowrap">
                        {row.share.toFixed(1)}%
                      </span>
                      <span className="mx-1.5 text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="whitespace-nowrap">
                        {formatCount(row.bills)} บิล
                      </span>
                    </span>
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
