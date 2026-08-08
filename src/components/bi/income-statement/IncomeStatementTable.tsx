"use client";

import type { BiIncomeStatementSummary } from "@/lib/bi/income-statement-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IncomeStatementTableProps = {
  summary: BiIncomeStatementSummary;
  citRate: number;
};

type Line = {
  label: string;
  amount: number;
  hint?: string;
  emphasize?: boolean;
  muted?: boolean;
  indent?: boolean;
};

export default function IncomeStatementTable({
  summary,
  citRate,
}: IncomeStatementTableProps) {
  const lines: Line[] = [
    {
      label: "รายได้จากภาษีขาย (ก่อน VAT)",
      amount: summary.revenue,
      hint: `${formatCount(summary.sales_bill_count)} บิล`,
    },
    {
      label: "หัก ต้นทุนซื้อสินค้า (ภาษีซื้อ)",
      amount: -summary.purchase_cost,
      hint: `${formatCount(summary.purchase_bill_count)} บิล`,
      indent: true,
      muted: true,
    },
    {
      label: "หัก ค่าใช้จ่ายที่มี VAT",
      amount: -summary.expense,
      hint: `${formatCount(summary.expense_bill_count)} ใบเสร็จ`,
      indent: true,
      muted: true,
    },
    {
      label: "กำไรก่อนภาษีเงินได้",
      amount: summary.profit_before_tax,
      hint:
        summary.profit_margin_pct != null
          ? `มาร์จิน ${summary.profit_margin_pct.toFixed(1)}%`
          : undefined,
      emphasize: true,
    },
    {
      label: `หัก ภาษีเงินได้นิติบุคคล (${(citRate * 100).toFixed(0)}%)`,
      amount: -summary.income_tax,
      hint: summary.profit_before_tax < 0 ? "ขาดทุน → ภาษี 0" : "ประมาณการ",
      indent: true,
      muted: true,
    },
    {
      label: "กำไรสุทธิหลังภาษี",
      amount: summary.net_profit,
      hint:
        summary.net_margin_pct != null
          ? `มาร์จิน ${summary.net_margin_pct.toFixed(1)}%`
          : undefined,
      emphasize: true,
    },
  ];

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
          งบกำไรขาดทุน (เฉพาะยอดมี VAT)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ใช้มูลค่าก่อนภาษีจากสมุดภาษีขาย/ซื้อเท่านั้น · ไม่รวมขายไม่มี VAT ·
          ไม่ใช่บัญชีนิติบุคคลเต็มรูป
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-sm">
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.label}
                className="border-b border-slate-100 last:border-0"
              >
                <td
                  className={cn(
                    "py-2.5 pr-3",
                    line.indent && "pl-4",
                    line.emphasize
                      ? "font-semibold text-slate-900"
                      : line.muted
                        ? "text-slate-600"
                        : "text-slate-800"
                  )}
                >
                  <div>{line.label}</div>
                  {line.hint ? (
                    <div className="text-xs font-normal text-muted-foreground">
                      {line.hint}
                    </div>
                  ) : null}
                </td>
                <td
                  className={cn(
                    "py-2.5 text-right tabular-nums",
                    line.emphasize
                      ? "font-semibold text-slate-900"
                      : "text-slate-800",
                    line.amount < 0 && !line.emphasize && "text-rose-700"
                  )}
                >
                  {formatBaht(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
