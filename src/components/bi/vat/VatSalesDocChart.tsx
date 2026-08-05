"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { BiVatDocRow } from "@/lib/bi/vat-types";
import {
  formatBaht,
  formatBahtCompact,
  formatCount,
  shareOf,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#0369a1",
  "#0f766e",
  "#b45309",
  "#4f46e5",
  "#be123c",
  "#15803d",
  "#a16207",
  "#7c3aed",
];

/** Map SYP 3* prefixes onto the same doc family as HQ (3TAR → TAR). */
function normalizeDocKey(key: string): string {
  const k = key.trim().toUpperCase();
  if (k.startsWith("3") && k.length > 1) return k.slice(1);
  return k;
}

type VatSalesDocChartProps = {
  title?: string;
  rows: BiVatDocRow[];
  totalVat: number;
  totalBefore: number;
  billCount: number;
  emptyLabel?: string;
};

export default function VatSalesDocChart({
  title = "ภาษีขายตามประเภทเอกสาร",
  rows,
  totalVat,
  totalBefore,
  billCount,
  emptyLabel = "ไม่มีภาษีขาย",
}: VatSalesDocChartProps) {
  const byKey = new Map<
    string,
    { key: string; tax: number; beforetax: number; bill_count: number }
  >();

  for (const row of rows) {
    const key = normalizeDocKey(row.key);
    const prev = byKey.get(key);
    if (prev) {
      prev.tax += row.tax;
      prev.beforetax += row.beforetax;
      prev.bill_count += row.bill_count;
    } else {
      byKey.set(key, {
        key,
        tax: row.tax,
        beforetax: row.beforetax,
        bill_count: row.bill_count,
      });
    }
  }

  const aggregated = [...byKey.values()].sort(
    (a, b) => Math.abs(b.tax) - Math.abs(a.tax)
  );

  const absTotal = aggregated.reduce((s, r) => s + Math.abs(r.tax), 0);
  const data = aggregated
    .filter((r) => r.tax !== 0 || r.bill_count > 0)
    .map((r) => ({
      key: r.key,
      name: r.key,
      value: Math.abs(r.tax),
      tax: r.tax,
      beforetax: r.beforetax,
      bills: r.bill_count,
      share: shareOf(Math.abs(r.tax), absTotal),
    }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,13rem)]">
            <div className="relative mx-auto h-52 w-full max-w-[16rem] min-w-0 sm:h-56 sm:max-w-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={2}
                  >
                    {data.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(_value, _name, item) => {
                      const payload = item?.payload as
                        | { tax?: number }
                        | undefined;
                      return formatBaht(payload?.tax ?? 0);
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  รวมภาษีขาย
                </p>
                <p className="text-lg font-semibold tabular-nums text-slate-900 sm:text-xl">
                  {formatBahtCompact(totalVat)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatCount(billCount)} บิล
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2.5">
                <p className="text-xs text-sky-900/70">มูลค่าสินค้า (ก่อน VAT)</p>
                <p className="text-base font-semibold tabular-nums text-sky-950">
                  {formatBaht(totalBefore)}
                </p>
                <p className="mt-0.5 text-xs text-sky-900/70">
                  ภาษีมูลค่าเพิ่ม{" "}
                  <span className="font-medium tabular-nums text-sky-950">
                    {formatBaht(totalVat)}
                  </span>
                </p>
              </div>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {data.map((row, i) => (
                  <li key={row.key} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800">
                        {row.name}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        <span className="whitespace-nowrap tabular-nums">
                          {formatBaht(row.tax)}
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
                          {formatCount(row.bills)} บิล
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
