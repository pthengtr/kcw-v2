"use client";

import type { BiCashflowBankReconciliation } from "@/lib/bi/cashflow-dashboard-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  data: BiCashflowBankReconciliation;
};

function Signed({
  value,
  emphasize,
}: {
  value: number;
  emphasize?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        emphasize && "font-semibold",
        value < 0 && "text-rose-700",
        value > 0 && emphasize && "text-emerald-700",
        Math.abs(value) > 0.009 && value !== 0 && !emphasize && value < 0
          ? "text-rose-700"
          : null
      )}
    >
      {formatBaht(value)}
    </span>
  );
}

export default function CashFlowBankReconciliation({ data }: Props) {
  const hasDiff = Math.abs(data.difference) > 0.009;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Bank Reconciliation
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ยอดคงเหลือตามบัญชีธนาคารเทียบกับคำนวณจากเงินเข้า–ออก
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Total Actual Bank Balance
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatBaht(data.total_actual_balance)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Calculated Cash Balance
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatBaht(data.total_calculated_balance)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              hasDiff
                ? "border-rose-200 bg-rose-50/70"
                : "border-slate-200 bg-slate-50/60"
            )}
          >
            <p className="text-xs text-muted-foreground">
              Reconciliation Difference
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                hasDiff ? "text-rose-700" : "text-slate-900"
              )}
            >
              {formatBaht(data.difference)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Account</th>
                <th className="py-2 pr-3 text-right font-medium">Opening</th>
                <th className="py-2 pr-3 text-right font-medium">Cash In</th>
                <th className="py-2 pr-3 text-right font-medium">Cash Out</th>
                <th className="py-2 pr-3 text-right font-medium">
                  Calculated Close
                </th>
                <th className="py-2 pr-3 text-right font-medium">Actual</th>
                <th className="py-2 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    ไม่มีข้อมูลบัญชี
                  </td>
                </tr>
              ) : (
                data.accounts.map((row) => {
                  const bad = Math.abs(row.variance) > 0.009;
                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        "border-b border-slate-100 last:border-0",
                        bad && "bg-rose-50/40"
                      )}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">
                          {row.account_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.account_name}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Signed value={row.opening_balance} />
                      </td>
                      <td className="py-2.5 pr-3 text-right text-teal-800">
                        {formatBaht(row.cash_in)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-rose-800">
                        {formatBaht(row.cash_out)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Signed value={row.calculated_closing} />
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium">
                        <Signed value={row.actual_balance} />
                      </td>
                      <td className="py-2.5 text-right">
                        <Signed value={row.variance} emphasize={bad} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
