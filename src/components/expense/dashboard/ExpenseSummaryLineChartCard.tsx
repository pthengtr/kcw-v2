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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ItemYearRow } from "./ExpenseDashboardPage";
import { ValueType } from "tailwindcss/types/config";

// ---------------- Types ----------------

export interface LineChartCardProps {
  data: ItemYearRow[]; // RPC output (English month keys)
  title?: string; // Card title (Thai string OK)
  defaultItemName?: string; // Optional preselected item
  yTickFormatter?: (v: number) => string; // Optional formatter (e.g., THB)
}

// ---------------- Consts ----------------
const MONTHS_EN = [
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
] as const;

const MONTHS_TH = [
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
] as const;

// ---------------- Helpers ----------------
function toChartSeries(row?: ItemYearRow) {
  if (!row) return [] as { month: string; value: number }[];

  return MONTHS_EN.map((en, i) => ({
    month: MONTHS_TH[i],
    value: row[en] ?? 0, // ✅ now TS knows 'en' is a valid key
  }));
}

// ---------------- Component ----------------
export default function ExpenseSummaryLineChartCard({
  data,
  title = "สรุปรายปี",
  defaultItemName,
  yTickFormatter,
}: LineChartCardProps) {
  const items = React.useMemo(
    () =>
      (data ?? [])
        .map((d) => d.item_name)
        .sort((a, b) => {
          if (a === "ทั้งหมด") return -1; // a goes first
          if (b === "ทั้งหมด") return 1; // b goes first
          return a.localeCompare(b, "th");
        }),
    [data]
  );

  const [selected, setSelected] = React.useState<string>(() => {
    if (defaultItemName && items.includes(defaultItemName))
      return defaultItemName;
    return items[0] ?? "";
  });

  React.useEffect(() => {
    // keep selection valid when data changes
    if (!items.includes(selected)) setSelected(items[0] ?? "");
  }, [items, selected]);

  const current = React.useMemo(
    () => data.find((d) => d.item_name === selected),
    [data, selected]
  );
  const series = React.useMemo(() => toChartSeries(current), [current]);

  return (
    <Card className="w-full max-w-3xl mx-auto rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="เลือกหมวดหมู่" />
          </SelectTrigger>
          <SelectContent align="end">
            {items.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series}
              margin={{ top: 10, right: 16, bottom: 0, left: 32 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickMargin={8} />
              <YAxis allowDecimals width={56} tickFormatter={yTickFormatter} />
              <Tooltip
                formatter={(value: ValueType) =>
                  typeof value === "number"
                    ? yTickFormatter
                      ? yTickFormatter(value)
                      : value
                    : value
                }
              />
              <Line type="monotone" dataKey="value" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!current && (
          <div className="text-sm text-muted-foreground mt-3">ไม่มีข้อมูล</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Usage Example ----------------
import LineChartCard, { ItemYearRow } from "./LineChartCardThai";

const rows: ItemYearRow[] = [
  { item_name: "ค่าสาธารณูปโภค", January: 1200, February: 900, March: 1100, April: 980, May: 1050, June: 1000, July: 1150, August: 990, September: 1020, October: 1080, November: 1110, December: 1300 },
  { item_name: "อุปกรณ์สำนักงาน", January: 400, February: 320, March: 280, April: 350, May: 300, June: 290, July: 310, August: 330, September: 360, October: 370, November: 390, December: 420 },
];

// Optional THB formatter
const thb = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);

<LineChartCard data={rows} title="ค่าใช้จ่าย (พ.ศ. 2568)" yTickFormatter={thb} />
*/
