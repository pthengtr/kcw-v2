"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatCount } from "@/lib/bi/sales-format";
import {
  STOCK_AUDIT_BUCKETS,
  type StockAuditOverview,
} from "@/lib/stock-audit/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PIE_COLORS: Record<string, string> = {
  never: "#94a3b8",
  over_365: "#e11d48",
  d365: "#f97316",
  d180: "#f59e0b",
  d90: "#84cc16",
  d30: "#10b981",
};

type Props = {
  overview: StockAuditOverview;
};

export default function StockAuditFreshnessPie({ overview }: Props) {
  const s = overview.summary;
  const data = STOCK_AUDIT_BUCKETS.map((b) => {
    const value =
      b.key === "never"
        ? s.never_count
        : b.key === "over_365"
          ? s.over_365_count
          : b.key === "d365"
            ? s.d365_count
            : b.key === "d180"
              ? s.d180_count
              : b.key === "d90"
                ? s.d90_count
                : s.d30_count;
    return {
      key: b.key,
      name: b.label,
      value,
      fill: PIE_COLORS[b.key],
    };
  }).filter((d) => d.value > 0);

  const total = s.total || 1;
  const freshPct = Math.round((1000 * s.d30_count) / total) / 10;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          สภาพการตรวจนับ
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          สด ≤30 วัน {freshPct}% · นับจากวันที่กดบันทึกในแอปเท่านั้น
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูล
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)]">
            <div className="mx-auto h-48 w-full max-w-[14rem] min-w-0 sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatCount(
                        typeof value === "number" ? value : Number(value)
                      )
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              {data.map((row) => (
                <li key={row.key} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: row.fill }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {row.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCount(row.value)} ·{" "}
                      {((100 * row.value) / total).toFixed(1)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
