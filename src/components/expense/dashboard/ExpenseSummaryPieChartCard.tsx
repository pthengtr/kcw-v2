import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ItemYearRow } from "./ExpenseDashboardPage";

export type MonthEn =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export interface PieChartCardProps {
  data: ItemYearRow[];
  title?: string;
  initialMonthIndex?: number;
  valueFormatter?: (v: number) => string;
  hideZeroSlices?: boolean;
  sortDescending?: boolean;
}

const MONTHS_EN: MonthEn[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const COLORS = [
  "#60a5fa", // blue-400
  "#38bdf8", // sky-400
  "#818cf8", // indigo-400
  "#2dd4bf", // teal-400
  "#93c5fd", // blue-300
  "#7dd3fc", // sky-300
  "#a5b4fc", // indigo-300
  "#5eead4", // teal-300
  "#2563eb", // blue-600
  "#0ea5e9", // sky-500
];
function monthIndexSafe(i?: number): number {
  return i != null && i >= 0 && i <= 11 ? i : new Date().getMonth();
}

function buildPieData(
  rows: ItemYearRow[],
  monthIndex: number,
  {
    hideZeroSlices = true,
    sortDescending = true,
  }: { hideZeroSlices?: boolean; sortDescending?: boolean }
) {
  const key = MONTHS_EN[monthIndex];
  let slices = rows
    .filter((r) => r.item_name && r.item_name !== "ทั้งหมด")
    .map((r) => ({ name: r.item_name, value: r[key] as number }))
    .filter((s) => (hideZeroSlices ? s.value !== 0 : true));

  if (sortDescending) {
    slices = slices.sort((a, b) => b.value - a.value);
  }
  return slices;
}

export default function PieChartCard({
  data,
  title = "สัดส่วนรายหมวด (Pie)",
  initialMonthIndex,
  valueFormatter,
  hideZeroSlices = true,
  sortDescending = true,
}: PieChartCardProps) {
  const [monthIdx, setMonthIdx] = React.useState<number>(
    monthIndexSafe(initialMonthIndex)
  );

  React.useEffect(() => {
    setMonthIdx((m) => monthIndexSafe(m));
  }, [initialMonthIndex]);

  const pieData = React.useMemo(
    () =>
      buildPieData(data ?? [], monthIdx, { hideZeroSlices, sortDescending }),
    [data, monthIdx, hideZeroSlices, sortDescending]
  );

  const totalValue = pieData.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card className="w-full max-w-3xl mx-auto rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <Select
          value={String(monthIdx)}
          onValueChange={(v) => setMonthIdx(Number(v))}
        >
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="เลือกเดือน" />
          </SelectTrigger>
          <SelectContent align="end">
            {MONTHS_TH.map((th, i) => (
              <SelectItem key={i} value={String(i)}>
                {th}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-[60vh]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                labelLine={false}
                label={({ name, value }) => {
                  const percent = (Number(value) / totalValue) * 100;
                  if (percent < 5) return "";
                  return `${name}: ${
                    valueFormatter ? valueFormatter(value as number) : value
                  }`;
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: ValueType) =>
                  typeof value === "number"
                    ? valueFormatter
                      ? valueFormatter(value)
                      : value
                    : value
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {pieData.length === 0 && (
          <div className="text-sm text-muted-foreground mt-3">ไม่มีข้อมูล</div>
        )}
      </CardContent>
    </Card>
  );
}
