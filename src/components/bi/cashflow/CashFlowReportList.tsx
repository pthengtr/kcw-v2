"use client";

import type { BiCashflowReportLine } from "@/lib/bi/cashflow-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  lines: BiCashflowReportLine[];
  otherCount?: number;
  otherIn?: number;
  otherOut?: number;
};

export default function CashFlowReportList({
  lines,
  otherCount = 0,
  otherIn = 0,
  otherOut = 0,
}: Props) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          รายงานกระแสเงินสด
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          จัดกลุ่มจาก bank statement ตามการจับคู่ (`matched_ref_type`) ·
          ไม่นับโอนระหว่างบัญชีในรายการรับ/จ่าย
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100">
          {lines.map((line) => {
            const emphasize =
              line.kind === "balance" || line.kind === "forecast";
            const out = line.kind === "out";
            const displayAmount =
              out && line.amount !== 0 ? -Math.abs(line.amount) : line.amount;

            return (
              <li
                key={line.key}
                className={cn(
                  "flex items-center justify-between gap-4 py-3",
                  emphasize && "bg-slate-50/60 px-2 -mx-2 rounded-md"
                )}
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm text-slate-800",
                      emphasize && "font-semibold text-slate-900"
                    )}
                  >
                    {line.label}
                  </p>
                  {line.line_count != null ? (
                    <p className="text-xs text-muted-foreground">
                      {formatCount(line.line_count)} รายการ
                    </p>
                  ) : line.kind === "forecast" ? (
                    <p className="text-xs text-muted-foreground">
                      ประมาณการจากเงินสดคงเหลือ + สุทธิเฉลี่ยต่อวัน × 30
                    </p>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "shrink-0 tabular-nums text-sm sm:text-base",
                    emphasize && "font-semibold",
                    displayAmount < 0 && "text-rose-700",
                    displayAmount > 0 && line.kind === "in" && "text-teal-800",
                    displayAmount > 0 &&
                      (line.kind === "balance" || line.kind === "forecast") &&
                      "text-emerald-800"
                  )}
                >
                  {formatBaht(displayAmount)}
                </p>
              </li>
            );
          })}
        </ul>

        {otherCount > 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            ยังไม่เข้ากลุ่มด้านบน {formatCount(otherCount)} รายการ (เข้า{" "}
            {formatBaht(otherIn)} · ออก {formatBaht(otherOut)}) —
            ส่วนใหญ่ยังไม่จับคู่หรืออยู่นอกหมวดที่กำหนด
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
