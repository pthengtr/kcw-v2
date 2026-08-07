"use client";

import type { BiCashflowBankReconciliation } from "@/lib/bi/cashflow-dashboard-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
        value < -0.009 && "text-rose-700",
        value > 0.009 && emphasize && "text-emerald-700"
      )}
    >
      {formatBaht(value)}
    </span>
  );
}

function openingSourceLabel(source: string): string {
  if (source === "prior_statement") return "จาก statement ก่อนปี";
  if (source === "inferred") return "คำนวณจากรายการแรก";
  return "ไม่มี";
}

export default function CashFlowBankReconciliation({ data }: Props) {
  const hasDiff = Math.abs(data.difference) > 0.009;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Bank Reconciliation · ตรวจครบถ้วนรายบัญชี
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ต่อบัญชี: Opening + Cash In − Cash Out ต้องเท่า Actual
          (`balance_after` ล่าสุด) — ถ้าไม่เท่า แปลว่า statement ในช่วงนี้ขาดช่วง
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">บัญชีที่ครบ</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-800">
              {formatCount(data.accounts_ok)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              data.accounts_gap > 0
                ? "border-rose-200 bg-rose-50/70"
                : "border-slate-200 bg-slate-50/60"
            )}
          >
            <p className="text-xs text-muted-foreground">บัญชีที่ขาดช่วง</p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                data.accounts_gap > 0 ? "text-rose-700" : "text-slate-900"
              )}
            >
              {formatCount(data.accounts_gap)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Total Actual Bank Balance
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatBaht(data.total_actual_balance)}
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
              รวมส่วนต่าง (Actual − Calculated)
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
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">สถานะ</th>
                <th className="py-2 pr-3 font-medium">บัญชี</th>
                <th className="py-2 pr-3 font-medium">ช่วงข้อมูล</th>
                <th className="py-2 pr-3 text-right font-medium">รายการ</th>
                <th className="py-2 pr-3 text-right font-medium">Opening</th>
                <th className="py-2 pr-3 text-right font-medium">Cash In</th>
                <th className="py-2 pr-3 text-right font-medium">Cash Out</th>
                <th className="py-2 pr-3 text-right font-medium">Calculated</th>
                <th className="py-2 pr-3 text-right font-medium">Actual</th>
                <th className="py-2 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 text-center text-muted-foreground"
                  >
                    ไม่มีข้อมูลบัญชีในช่วงนี้
                  </td>
                </tr>
              ) : (
                data.accounts.map((row) => {
                  const bad = !row.is_complete;
                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        "border-b border-slate-100 last:border-0",
                        bad && "bg-rose-50/40"
                      )}
                    >
                      <td className="py-2.5 pr-3">
                        {bad ? (
                          <Badge
                            variant="secondary"
                            className="bg-rose-100 text-rose-800 hover:bg-rose-100"
                          >
                            ขาดช่วง
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          >
                            ครบ
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">
                          {row.account_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.account_name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Opening: {openingSourceLabel(row.opening_source)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-slate-600">
                        {row.first_txn_date && row.last_txn_date
                          ? `${row.first_txn_date} → ${row.last_txn_date}`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600">
                        {formatCount(row.line_count)}
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
