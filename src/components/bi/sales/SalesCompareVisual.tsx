"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildChartRowsForYears,
  monthKeyLabel,
} from "@/lib/bi/sales-compare";
import type {
  BiSalesCompareResult,
  BiSalesCompareViz,
} from "@/lib/bi/sales-compare-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SERIES_COLORS = ["#0f766e", "#0369a1", "#b45309", "#7c3aed", "#be123c"];

type SalesCompareVisualProps = {
  compare: BiSalesCompareResult;
  viz: BiSalesCompareViz;
};

function formatAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

export default function SalesCompareVisual({
  compare,
  viz,
}: SalesCompareVisualProps) {
  if (compare.mode === "months") {
    return (
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            เปรียบเทียบเดือนที่เลือก
          </CardTitle>
        </CardHeader>
        <CardContent>
          {compare.period_points.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              เลือกเดือนเพื่อเปรียบเทียบ
            </p>
          ) : viz === "table" ? (
            <MonthPeriodTable compare={compare} />
          ) : (
            <MonthPeriodChart compare={compare} viz={viz} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          เปรียบเทียบรายเดือนตามปี
        </CardTitle>
      </CardHeader>
      <CardContent>
        {compare.series.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            เลือกปีเพื่อเปรียบเทียบ
          </p>
        ) : viz === "table" ? (
          <YearMonthTable compare={compare} />
        ) : (
          <YearMonthChart compare={compare} viz={viz} />
        )}
      </CardContent>
    </Card>
  );
}

function YearMonthTable({ compare }: { compare: BiSalesCompareResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">เดือน</th>
            {compare.series.map((s) => (
              <th key={s.year} className="px-2 py-2 text-right font-medium">
                {s.year + 543}
                <span className="block text-[10px] font-normal">
                  ({s.year})
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {compare.month_keys.map((mm) => (
            <tr key={mm} className="border-b border-slate-100">
              <td className="py-2 pr-3 font-medium text-slate-800">
                {monthKeyLabel(mm)}
              </td>
              {compare.series.map((s) => (
                <td
                  key={s.year}
                  className="whitespace-nowrap px-2 py-2 text-right tabular-nums"
                >
                  {formatBaht(s.by_month[mm]?.revenue_net ?? 0)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-slate-50/80 font-medium">
            <td className="py-2.5 pr-3">รวม</td>
            {compare.series.map((s) => (
              <td
                key={s.year}
                className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums"
              >
                {formatBaht(s.total_revenue_net)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function YearMonthChart({
  compare,
  viz,
}: {
  compare: BiSalesCompareResult;
  viz: "bar" | "line";
}) {
  const data = buildChartRowsForYears(compare.series);
  const Chart = viz === "bar" ? BarChart : LineChart;

  return (
    <div className="h-72 w-full min-w-0 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={56}
            tickFormatter={formatAxis}
          />
          <Tooltip
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : Number(value);
              const year = String(name).replace(/^y/, "");
              return [formatBaht(n), `ปี ${Number(year) + 543}`];
            }}
          />
          <Legend
            formatter={(value) => {
              const year = String(value).replace(/^y/, "");
              return `${Number(year) + 543}`;
            }}
          />
          {compare.series.map((s, index) =>
            viz === "bar" ? (
              <Bar
                key={s.year}
                dataKey={`y${s.year}`}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                name={`y${s.year}`}
                radius={[3, 3, 0, 0]}
              />
            ) : (
              <Line
                key={s.year}
                type="monotone"
                dataKey={`y${s.year}`}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={false}
                name={`y${s.year}`}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthPeriodTable({ compare }: { compare: BiSalesCompareResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">เดือน</th>
            <th className="py-2 pr-3 text-right font-medium">ยอดสุทธิ</th>
            <th className="py-2 text-right font-medium">จำนวนบิล</th>
          </tr>
        </thead>
        <tbody>
          {compare.period_points.map((row) => (
            <tr key={row.period} className="border-b border-slate-100">
              <td className="py-2 pr-3 font-medium">{row.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatBaht(row.revenue_net)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCount(row.bill_count)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthPeriodChart({
  compare,
  viz,
}: {
  compare: BiSalesCompareResult;
  viz: "bar" | "line";
}) {
  const data = compare.period_points.map((p) => ({
    ...p,
    short: p.period.slice(5) + "/" + p.period.slice(2, 4),
  }));
  const Chart = viz === "bar" ? BarChart : LineChart;

  return (
    <div className="h-72 w-full min-w-0 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="short" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={56}
            tickFormatter={formatAxis}
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [formatBaht(n), "ยอดสุทธิ"];
            }}
            labelFormatter={(_, payload) =>
              String(payload?.[0]?.payload?.label ?? "")
            }
          />
          {viz === "bar" ? (
            <Bar
              dataKey="revenue_net"
              fill={SERIES_COLORS[0]}
              radius={[3, 3, 0, 0]}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="revenue_net"
              stroke={SERIES_COLORS[0]}
              strokeWidth={2}
              dot
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
