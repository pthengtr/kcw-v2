"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCount } from "@/lib/bi/sales-format";
import type { StockWorkDaily } from "@/lib/stock-audit/work-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  series: StockWorkDaily[];
  completedToday: number;
  completedWeek: number;
  selectedDate?: string;
  dayLabel?: string;
  onSelectDate?: (date: string) => void;
};

function shortDay(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

export default function StockAuditWorkDailyChart({
  series,
  completedToday,
  completedWeek,
  selectedDate,
  dayLabel = "วันนี้",
  onSelectDate,
}: Props) {
  const data = series.map((d) => ({
    ...d,
    label: shortDay(d.date),
  }));
  const hasAny = data.some((d) => d.completed_counts > 0 || d.total_actions > 0);

  return (
    <Card className="min-w-0 w-full border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          จำนวนนับเสร็จต่อวัน
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {dayLabel} {formatCount(completedToday)} · 7 วันย้อนหลัง{" "}
          {formatCount(completedWeek)} (นับตรง+คลาด)
          {onSelectDate ? " · กดแท่งกราฟเพื่อดูวันนั้น" : null}
        </p>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-slate-800">
              ยังไม่มีงานตรวจนับ
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              เมื่อนับผ่าน LINE (เช็คสต็อก) กราฟนี้จะโชว์ความคืบหน้ารายวัน
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
                    "นับเสร็จ",
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | { date?: string }
                      | undefined;
                    return row?.date ?? "";
                  }}
                />
                <Bar
                  dataKey="completed_counts"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  cursor={onSelectDate ? "pointer" : undefined}
                  onClick={(entry) => {
                    const row = entry as
                      | { date?: string; payload?: { date?: string } }
                      | undefined;
                    const date = row?.date ?? row?.payload?.date;
                    if (date && onSelectDate) onSelectDate(date);
                  }}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.date}
                      fill={d.date === selectedDate ? "#1e40af" : "#2563eb"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
