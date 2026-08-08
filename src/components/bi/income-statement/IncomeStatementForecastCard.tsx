"use client";

import type {
  BiIncomeStatementForecast,
  BiIncomeStatementSummary,
} from "@/lib/bi/income-statement-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { formatThaiDateRange } from "@/lib/bi/sales-periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IncomeStatementForecastCardProps = {
  forecast: BiIncomeStatementForecast;
  summary: BiIncomeStatementSummary;
  from: string;
  to: string;
  citRate: number;
};

export default function IncomeStatementForecastCard({
  forecast,
  summary,
  from,
  to,
  citRate,
}: IncomeStatementForecastCardProps) {
  if (!forecast.enabled) {
    return (
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            พยากรณ์สิ้นงวด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ช่วง{" "}
            <span className="font-medium text-slate-700">
              {formatThaiDateRange(from, to)}
            </span>{" "}
            ครบแล้ว — ใช้ยอดจริงแทนพยากรณ์ (กำไรก่อนภาษี{" "}
            {formatBaht(summary.profit_before_tax)} · ภาษีเงินได้{" "}
            {formatBaht(summary.income_tax)})
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    { label: "รายได้ (ภาษีขาย)", actual: summary.revenue, forecast: forecast.revenue },
    {
      label: "ต้นทุนซื้อสินค้า",
      actual: summary.purchase_cost,
      forecast: forecast.purchase_cost,
    },
    {
      label: "ค่าใช้จ่าย (VAT)",
      actual: summary.expense,
      forecast: forecast.expense,
    },
    {
      label: "กำไรก่อนภาษี",
      actual: summary.profit_before_tax,
      forecast: forecast.profit_before_tax,
    },
    {
      label: `ภาษีเงินได้ (${(citRate * 100).toFixed(0)}%)`,
      actual: summary.income_tax,
      forecast: forecast.income_tax,
    },
    {
      label: "กำไรสุทธิ (หลังภาษี)",
      actual: summary.net_profit,
      forecast: forecast.net_profit,
      emphasize: true,
    },
  ];

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-amber-950">
          พยากรณ์สิ้นงวด (อัตราเฉลี่ยรายวัน)
        </CardTitle>
        <p className="text-xs text-amber-900/80">
          ข้อมูลถึง {forecast.as_of} · {forecast.days_elapsed}/
          {forecast.days_in_range} วัน · คูณ ×{forecast.factor.toFixed(2)}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-amber-200/80 text-xs text-amber-900/70">
              <th className="py-2 pr-3 font-medium">รายการ</th>
              <th className="py-2 pr-3 font-medium text-right">ยอดจริง</th>
              <th className="py-2 font-medium text-right">พยากรณ์สิ้นงวด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-amber-100/80 last:border-0"
              >
                <td
                  className={
                    row.emphasize
                      ? "py-2.5 pr-3 font-semibold text-amber-950"
                      : "py-2.5 pr-3 text-slate-800"
                  }
                >
                  {row.label}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                  {formatBaht(row.actual)}
                </td>
                <td
                  className={
                    row.emphasize
                      ? "py-2.5 text-right font-semibold tabular-nums text-amber-950"
                      : "py-2.5 text-right tabular-nums text-slate-900"
                  }
                >
                  {formatBaht(row.forecast)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
