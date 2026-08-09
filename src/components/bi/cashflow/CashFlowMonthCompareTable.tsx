"use client";

import type { BiCashflowReportMonthRow } from "@/lib/bi/cashflow-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { formatThaiPeriodLabel } from "@/lib/bi/sales-periods";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  monthColumns: string[];
  rows: BiCashflowReportMonthRow[];
};

const compactBaht = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function displayAmount(
  amount: number,
  kind: BiCashflowReportMonthRow["kind"]
): number {
  if (kind === "out" && amount !== 0) return -Math.abs(amount);
  return amount;
}

function formatCell(amount: number): string {
  if (!amount) return "—";
  if (Math.abs(amount) >= 10_000) return compactBaht.format(amount);
  return formatBaht(amount);
}

export default function CashFlowMonthCompareTable({
  monthColumns,
  rows,
}: Props) {
  const monthLabels = monthColumns.map((period) => ({
    period,
    label: formatThaiPeriodLabel(period, "monthly"),
    short: period.slice(5),
  }));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          รายละเอียดรายเดือน
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          แถว = รายการกระแสเงินสด · คอลัมน์ = เดือน (ตั้งแต่ต้นปี)
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {monthColumns.length === 0 || rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลรายเดือน
          </p>
        ) : (
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-medium">
                  รายการ
                </th>
                {monthLabels.map((m) => (
                  <th
                    key={m.period}
                    className="px-2 py-2 text-right font-medium"
                    title={m.label}
                  >
                    {m.short}
                  </th>
                ))}
                <th className="py-2 pl-2 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const emphasize =
                  row.kind === "balance" || row.kind === "forecast";
                const totalDisplay = displayAmount(row.total, row.kind);

                return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-slate-100 last:border-0",
                      emphasize && "bg-slate-50/70"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 max-w-[12rem] py-2 pr-3",
                        emphasize
                          ? "bg-slate-50 font-semibold text-slate-900"
                          : "bg-white font-medium text-slate-900"
                      )}
                    >
                      <span className="block truncate">{row.label}</span>
                    </td>
                    {monthColumns.map((period) => {
                      const value = displayAmount(
                        row.months[period] ?? 0,
                        row.kind
                      );
                      return (
                        <td
                          key={period}
                          className={cn(
                            "whitespace-nowrap px-2 py-2 text-right tabular-nums",
                            value < 0 && "text-rose-700",
                            value > 0 && row.kind === "in" && "text-teal-800",
                            value > 0 &&
                              (row.kind === "balance" ||
                                row.kind === "forecast") &&
                              "text-emerald-800"
                          )}
                        >
                          {formatCell(value)}
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "whitespace-nowrap py-2 pl-2 text-right tabular-nums font-medium",
                        totalDisplay < 0 && "text-rose-700",
                        totalDisplay > 0 &&
                          row.kind === "in" &&
                          "text-teal-800",
                        totalDisplay > 0 &&
                          (row.kind === "balance" ||
                            row.kind === "forecast") &&
                          "text-emerald-800"
                      )}
                    >
                      {formatBaht(totalDisplay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
