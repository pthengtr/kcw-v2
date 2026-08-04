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

import { formatCount } from "@/lib/bi/sales-format";
import type { StockAuditDailyMark } from "@/lib/stock-audit/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  series: StockAuditDailyMark[];
  markedToday: number;
  markedWeek: number;
};

function shortDay(iso: string): string {
  // YYYY-MM-DD → d/M
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

export default function StockAuditDailyChart({
  series,
  markedToday,
  markedWeek,
}: Props) {
  const data = series.map((d) => ({
    ...d,
    label: shortDay(d.date),
  }));
  const hasAny = data.some((d) => d.count > 0);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          จำนวนที่ตรวจต่อวัน
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          วันนี้ {formatCount(markedToday)} · 7 วันล่าสุด{" "}
          {formatCount(markedWeek)} รายการ
        </p>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-slate-800">
              ยังไม่เริ่มบันทึกในแอป
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              เมื่อกด “ตรวจแล้ว” กราฟนี้จะโชว์ความคืบหน้ารายวัน
            </p>
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={36}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCount(
                      typeof value === "number" ? value : Number(value)
                    ),
                    "ตรวจแล้ว",
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | { date?: string }
                      | undefined;
                    return row?.date ?? "";
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#0f766e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
