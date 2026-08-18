"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { BiProductSalesBranchRow } from "@/lib/bi/product-sales-types";
import { BRANCH_MIX_COLORS } from "@/lib/bi/product-sales-types";
import {
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  labelFor,
  shareOf,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: BiProductSalesBranchRow[];
};

const SLICE_ORDER = ["HQ", "SYP", "ONLINE"] as const;

function colorFor(key: string): string {
  return BRANCH_MIX_COLORS[key] ?? "#64748b";
}

export default function ProductSalesBranchPie({ rows }: Props) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const ordered = SLICE_ORDER.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        revenue_net: 0,
        base_qty: 0,
        bill_count: 0,
        cogs: 0,
        gross_profit: 0,
      }
  );
  const total = ordered.reduce((sum, r) => sum + r.revenue_net, 0);
  const data = ordered
    .filter((r) => r.revenue_net !== 0)
    .map((r) => ({
      key: r.key,
      name: labelFor(BRANCH_LABELS, r.key),
      value: r.revenue_net,
      qty: r.base_qty,
      share: shareOf(r.revenue_net, total),
    }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          สัดส่วนยอดขายตามสาขา
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          HQ / SYP / ออนไลน์ · ตามยอดสุทธิในช่วงที่เลือก
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            ไม่มียอดขายในช่วงนี้
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,12rem)]">
            <div className="mx-auto h-48 w-full max-w-[14rem] min-w-0 sm:h-52 sm:max-w-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={colorFor(entry.key)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatBaht(
                        typeof value === "number" ? value : Number(value)
                      )
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2.5 text-sm">
              {data.map((row) => (
                <li key={row.key} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: colorFor(row.key) }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {row.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      <span className="whitespace-nowrap">
                        {formatBaht(row.value)}
                      </span>
                      <span className="mx-1.5 text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="whitespace-nowrap">
                        {row.share.toFixed(1)}%
                      </span>
                      <span className="mx-1.5 text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="whitespace-nowrap">
                        {formatCount(row.qty)} หน่วย
                      </span>
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
