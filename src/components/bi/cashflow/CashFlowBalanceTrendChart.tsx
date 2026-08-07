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

import type { BiCashflowBalanceTrend } from "@/lib/bi/cashflow-dashboard-types";
import { formatBaht, formatBahtCompact } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTH_TH = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

type Props = {
  rows: BiCashflowBalanceTrend[];
};

export default function CashFlowBalanceTrendChart({ rows }: Props) {
  const data = rows
    .filter((r) => r.has_data)
    .map((r) => ({
      ...r,
      label: MONTH_TH[r.month] ?? String(r.month),
      opening_cash: r.opening_cash ?? 0,
      ending_cash: r.ending_cash ?? 0,
    }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          แนวโน้มยอดเงินสด
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ต้นงวด / ปลายงวด จากยอดคงเหลือใน statement
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลแนวโน้ม
          </p>
        ) : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cfEnd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={56}
                  tickFormatter={(v) => formatBahtCompact(Number(v))}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n = typeof value === "number" ? value : Number(value);
                    if (name === "opening_cash")
                      return [formatBaht(n), "ต้นงวด"];
                    if (name === "ending_cash")
                      return [formatBaht(n), "ปลายงวด"];
                    return [String(value), String(name)];
                  }}
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.period ?? "")
                  }
                />
                <Legend
                  formatter={(v) =>
                    v === "opening_cash"
                      ? "ต้นงวด"
                      : v === "ending_cash"
                        ? "ปลายงวด"
                        : v
                  }
                />
                <Area
                  type="monotone"
                  dataKey="opening_cash"
                  stroke="#64748b"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  name="opening_cash"
                />
                <Area
                  type="monotone"
                  dataKey="ending_cash"
                  stroke="#0f766e"
                  fill="url(#cfEnd)"
                  strokeWidth={2}
                  name="ending_cash"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
