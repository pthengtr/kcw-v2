"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildProductSalesPriceSeries } from "@/lib/bi/product-sales-chart";
import type {
  BiProductPurchaseHistoryRow,
  BiProductSalesTrendRow,
} from "@/lib/bi/product-sales-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  rows: BiProductSalesTrendRow[];
  purchases: BiProductPurchaseHistoryRow[];
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

function formatPctTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  return `${value.toFixed(0)}%`;
}

export default function ProductSalesPriceChart({
  title,
  rows,
  purchases,
  mode,
}: Props) {
  const data = buildProductSalesPriceSeries(rows, purchases, mode).map(
    (r) => ({
      ...r,
      label: shortLabel(r.period, mode),
    })
  );
  const hasBuy = data.some((r) => r.avg_buy != null);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          ราคาขายเฉลี่ยต่อหน่วย vs ต้นทุนขาย (LAST_PURCHASE_COST ของหน่วยที่ขาย)
          {hasBuy
            ? " · จุดคือราคาซื้อเข้า HQ ในช่วงนี้ (ไม่ใช่ COGS)"
            : " · ไม่มีซื้อเข้าในช่วงนี้"}
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลราคา
          </p>
        ) : (
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="price"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={56}
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1_000
                      ? `${(v / 1_000).toFixed(1)}k`
                      : String(Math.round(v))
                  }
                />
                <YAxis
                  yAxisId="margin"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#7c3aed" }}
                  width={44}
                  tickFormatter={formatPctTick}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n =
                      typeof value === "number" ? value : Number(value);
                    if (name === "avg_sale")
                      return [formatBaht(n, true), "ราคาขายเฉลี่ย"];
                    if (name === "avg_cost")
                      return [formatBaht(n, true), "ต้นทุนขาย/หน่วย"];
                    if (name === "avg_buy")
                      return [formatBaht(n, true), "ราคาซื้อเข้า"];
                    if (name === "margin_pct")
                      return [`${n.toFixed(1)}%`, "อัตรากำไร"];
                    return [formatCount(n), String(name)];
                  }}
                  labelFormatter={(_, payload) => {
                    const period = payload?.[0]?.payload?.period;
                    return period ? String(period) : "";
                  }}
                />
                <Legend />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="avg_sale"
                  name="ราคาขายเฉลี่ย"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="avg_cost"
                  name="ต้นทุนขาย/หน่วย"
                  stroke="#b45309"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                  connectNulls
                />
                {hasBuy ? (
                  <Scatter
                    yAxisId="price"
                    dataKey="avg_buy"
                    name="ราคาซื้อเข้า"
                    fill="#0369a1"
                    shape="diamond"
                  />
                ) : null}
                <Line
                  yAxisId="margin"
                  type="monotone"
                  dataKey="margin_pct"
                  name="อัตรากำไร %"
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
