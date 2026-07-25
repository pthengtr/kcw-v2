"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import type { BiTrendRow } from "@/lib/bi/sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SalesTrendChartProps = {
  title: string;
  rows: BiTrendRow[];
  mode: "daily" | "monthly";
};

function shortLabel(period: string, mode: "daily" | "monthly"): string {
  if (mode === "monthly") {
    const [y, m] = period.split("-");
    return m && y ? `${m}/${y.slice(2)}` : period;
  }
  const parts = period.split("-");
  if (parts.length === 3) return `${Number(parts[2])}/${Number(parts[1])}`;
  return period;
}

export default function SalesTrendChart({
  title,
  rows,
  mode,
}: SalesTrendChartProps) {
  const data = rows.map((r) => ({
    ...r,
    label: shortLabel(r.period, mode),
  }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลแนวโน้ม
          </p>
        ) : (
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={56}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : Math.abs(v) >= 1_000
                        ? `${(v / 1_000).toFixed(0)}k`
                        : String(v)
                  }
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n = typeof value === "number" ? value : Number(value);
                    if (name === "revenue_net") return [formatBaht(n), "ยอดขายสุทธิ"];
                    if (name === "bill_count") return [formatCount(n), "จำนวนบิล"];
                    return [String(value), String(name)];
                  }}
                  labelFormatter={(_, payload) => {
                    const period = payload?.[0]?.payload?.period;
                    return period ? String(period) : "";
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue_net"
                  stroke="#0f766e"
                  fill="url(#salesRev)"
                  strokeWidth={2}
                  name="revenue_net"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
