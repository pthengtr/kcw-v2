"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BiCashflowMonthMovement } from "@/lib/bi/cashflow-dashboard-types";
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
  rows: BiCashflowMonthMovement[];
};

export default function CashFlowMovementChart({ rows }: Props) {
  const data = rows
    .filter((r) => r.has_data)
    .map((r) => ({
      ...r,
      label: MONTH_TH[r.month] ?? String(r.month),
      cash_in: r.cash_in ?? 0,
      cash_out: r.cash_out ?? 0,
      net_change: r.net_change ?? 0,
    }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          กระแสเงินสดรายเดือน
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          เงินเข้า / เงินออก / สุทธิ (เฉพาะเดือนที่มีข้อมูล · ไม่นับโอนระหว่างบัญชี)
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
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
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
                    if (name === "cash_in") return [formatBaht(n), "เงินเข้า"];
                    if (name === "cash_out") return [formatBaht(n), "เงินออก"];
                    if (name === "net_change") return [formatBaht(n), "สุทธิ"];
                    return [String(value), String(name)];
                  }}
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.period ?? "")
                  }
                />
                <Legend
                  formatter={(v) =>
                    v === "cash_in"
                      ? "เงินเข้า"
                      : v === "cash_out"
                        ? "เงินออก"
                        : v === "net_change"
                          ? "สุทธิ"
                          : v
                  }
                />
                <Bar
                  dataKey="cash_in"
                  fill="#0f766e"
                  name="cash_in"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="cash_out"
                  fill="#be123c"
                  name="cash_out"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="net_change"
                  stroke="#0369a1"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="net_change"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
