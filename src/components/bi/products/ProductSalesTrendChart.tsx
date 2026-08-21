"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import type { BiProductSalesTrendRow } from "@/lib/bi/product-sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  rows: BiProductSalesTrendRow[];
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

export default function ProductSalesTrendChart({ title, rows, mode }: Props) {
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
              <AreaChart
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
                    if (name === "hq_revenue_net") return [formatBaht(n), "HQ"];
                    if (name === "syp_revenue_net") return [formatBaht(n), "SYP"];
                    if (name === "online_revenue_net")
                      return [formatBaht(n), "ออนไลน์"];
                    if (name === "gross_profit")
                      return [formatBaht(n), "กำไรขั้นต้น"];
                    return [formatCount(n), String(name)];
                  }}
                  labelFormatter={(_, payload) => {
                    const period = payload?.[0]?.payload?.period;
                    return period ? String(period) : "";
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="hq_revenue_net"
                  name="HQ"
                  stackId="rev"
                  stroke="#0f766e"
                  fill="#0f766e"
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="syp_revenue_net"
                  name="SYP"
                  stackId="rev"
                  stroke="#0369a1"
                  fill="#0369a1"
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="online_revenue_net"
                  name="ออนไลน์"
                  stackId="rev"
                  stroke="#b45309"
                  fill="#b45309"
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
