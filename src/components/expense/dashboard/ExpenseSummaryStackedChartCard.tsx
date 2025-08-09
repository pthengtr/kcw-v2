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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ItemYearRow } from "./ExpenseDashboardPage";

// ------------- Types -------------
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

export interface StackedBarCardProps {
  entriesData: ItemYearRow[]; // expense_receipt + expense_entry
  generalData: ItemYearRow[]; // expense_general
  title?: string;
  defaultItemName?: string;
  yTickFormatter?: (v: number) => string; // e.g., THB
}

// ------------- Constants -------------
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

// Mid‑tone cool palette to match shadcn blue theme
const COLORS = {
  entries: "#60a5fa", // blue-400
  general: "#38bdf8", // sky-400
};

// ------------- Helpers -------------
function monthKey(i: number): MonthEn {
  return MONTHS_EN[i];
}
function monthLabelTH(i: number): string {
  return MONTHS_TH[i];
}

function findRow(rows: ItemYearRow[], name: string): ItemYearRow | undefined {
  return rows.find((r) => r.item_name === name);
}

function buildChartData(
  item: string,
  a: ItemYearRow[] = [],
  b: ItemYearRow[] = []
) {
  if (!a) return [] as { month: string; value: number }[];
  if (!b) return [] as { month: string; value: number }[];

  const rowA = findRow(a, item);
  const rowB = findRow(b, item);
  return Array.from({ length: 12 }, (_, i) => ({
    month: monthLabelTH(i),
    entries: (rowA ? rowA[monthKey(i)] : 0) as number,
    general: (rowB ? rowB[monthKey(i)] : 0) as number,
  }));
}

// ------------- Component -------------
export default function ExpenseSummaryStackedChartCard({
  entriesData,
  generalData,
  title = "ค่าใช้จ่ายแยกที่มา (Stacked)",
  defaultItemName,
  yTickFormatter,
}: StackedBarCardProps) {
  const itemNames = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of entriesData ?? []) set.add(r.item_name);
    for (const r of generalData ?? []) set.add(r.item_name);
    return Array.from(set).sort((a, b) => {
      if (a === "ทั้งหมด") return -1; // a goes first
      if (b === "ทั้งหมด") return 1; // b goes first
      return a.localeCompare(b, "th");
    });
  }, [entriesData, generalData]);

  const [selected, setSelected] = React.useState<string>(() => {
    if (defaultItemName && itemNames.includes(defaultItemName))
      return defaultItemName;
    return itemNames[0] ?? "";
  });

  React.useEffect(() => {
    if (!itemNames.includes(selected)) setSelected(itemNames[0] ?? "");
  }, [itemNames, selected]);

  const chartData = React.useMemo(
    () => (selected ? buildChartData(selected, entriesData, generalData) : []),
    [selected, entriesData, generalData]
  );

  return (
    <Card className="w-full max-w-3xl mx-auto rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="เลือกหมวดหมู่" />
          </SelectTrigger>
          <SelectContent align="end">
            {itemNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-[60vh]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 16, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickMargin={8} />
              <YAxis width={56} tickFormatter={yTickFormatter} />
              <Tooltip
                formatter={(value: ValueType) =>
                  typeof value === "number"
                    ? yTickFormatter
                      ? yTickFormatter(value)
                      : value
                    : value
                }
              />
              <Legend />
              <Bar
                dataKey="entries"
                name="บริษัท"
                stackId="a"
                fill={COLORS.entries}
                radius={[3, 3, 3, 3]}
              />
              <Bar
                dataKey="general"
                name="ทั่วไป"
                stackId="a"
                fill={COLORS.general}
                radius={[3, 3, 3, 3]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {chartData.length === 0 && (
          <div className="text-sm text-muted-foreground mt-3">ไม่มีข้อมูล</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Usage Example ----------------
import StackedBarCard, { ItemYearRow } from "./StackedBarCard";

const entriesRows: ItemYearRow[] = [
  { item_name: "ค่าสาธารณูปโภค", January: 1200, February: 900, March: 1100, April: 980, May: 1050, June: 1000, July: 1150, August: 990, September: 1020, October: 1080, November: 1110, December: 1300 },
];

const generalRows: ItemYearRow[] = [
  { item_name: "ค่าสาธารณูปโภค", January: 200, February: 180, March: 150, April: 220, May: 210, June: 190, July: 205, August: 215, September: 180, October: 195, November: 210, December: 230 },
];

const thb = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);

<StackedBarCard entriesData={entriesRows} generalData={generalRows} title="เปรียบเทียบค่าใช้จ่ายรายเดือน" yTickFormatter={thb} />
*/
