"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BiCashflowTrendRow } from "@/lib/bi/cashflow-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CashFlowTrendChartProps = {
  title: string;
  rows: BiCashflowTrendRow[];
  mode?: "daily" | "monthly";
};

function shortLabel(period: string, mode: "daily" | "monthly"): string {
  if (mode === "daily") {
    const parts = period.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : period;
  }
  const [y, m] = period.split("-");
  return m && y ? `${m}/${y.slice(2)}` : period;
}

export default function CashFlowTrendChart({
  title,
  rows,
  mode = "monthly",
}: CashFlowTrendChartProps) {
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
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
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
                    if (name === "inflow") return [formatBaht(n), "เงินเข้า"];
                    if (name === "outflow") return [formatBaht(n), "เงินออก"];
                    if (name === "net") return [formatBaht(n), "สุทธิ"];
                    if (name === "line_count")
                      return [formatCount(n), "รายการ"];
                    return [String(value), String(name)];
                  }}
                  labelFormatter={(_, payload) => {
                    const period = payload?.[0]?.payload?.period;
                    return period ? String(period) : "";
                  }}
                />
                <Legend
                  formatter={(value) => {
                    if (value === "inflow") return "เงินเข้า";
                    if (value === "outflow") return "เงินออก";
                    if (value === "net") return "สุทธิ";
                    return value;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="inflow"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                  name="inflow"
                />
                <Line
                  type="monotone"
                  dataKey="outflow"
                  stroke="#be123c"
                  strokeWidth={2}
                  dot={false}
                  name="outflow"
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#0369a1"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  name="net"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
