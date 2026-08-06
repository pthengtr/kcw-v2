"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BiCashflowCategoryRow } from "@/lib/bi/cashflow-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CashFlowCategoryChartProps = {
  title: string;
  rows: BiCashflowCategoryRow[];
  direction: "inflow" | "outflow";
  maxBars?: number;
};

export default function CashFlowCategoryChart({
  title,
  rows,
  direction,
  maxBars = 8,
}: CashFlowCategoryChartProps) {
  const sorted = [...rows]
    .filter((r) => r[direction] > 0)
    .sort((a, b) => b[direction] - a[direction])
    .slice(0, maxBars)
    .map((r) => ({
      key: r.key,
      label: r.label,
      amount: r[direction],
    }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูล
          </p>
        ) : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : Math.abs(v) >= 1_000
                        ? `${(v / 1_000).toFixed(0)}k`
                        : String(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fontSize: 11, fill: "#475569" }}
                />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return [formatBaht(n), "ยอด"];
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill={direction === "inflow" ? "#0f766e" : "#be123c"}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
