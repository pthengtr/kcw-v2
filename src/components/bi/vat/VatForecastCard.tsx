"use client";

import type { BiVatForecast, BiVatSummary } from "@/lib/bi/vat-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { formatThaiDateRange } from "@/lib/bi/sales-periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VatForecastCardProps = {
  forecast: BiVatForecast;
  summary: BiVatSummary;
  from: string;
  to: string;
};

export default function VatForecastCard({
  forecast,
  summary,
  from,
  to,
}: VatForecastCardProps) {
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
            ครบแล้ว — ใช้ยอดจริงแทนพยากรณ์ (ภาษีสุทธิ{" "}
            {formatBaht(summary.net_vat)})
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    {
      label: "ภาษีขาย",
      actual: summary.sales_vat,
      forecast: forecast.sales_vat,
    },
    {
      label: "ภาษีซื้อ (สินค้า)",
      actual: summary.purchase_vat,
      forecast: forecast.purchase_vat,
    },
    {
      label: "ภาษีซื้อ (ค่าใช้จ่าย)",
      actual: summary.expense_vat,
      forecast: forecast.expense_vat,
    },
    {
      label: "ภาษีสุทธิที่ต้องชำระ",
      actual: summary.net_vat,
      forecast: forecast.net_vat,
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
              <th className="py-2 pr-3 font-medium text-right">ยอดจริง (MTD)</th>
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
