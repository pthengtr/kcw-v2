"use client";

import type { BiCashflowOperatingBreakdown as Row } from "@/lib/bi/cashflow-dashboard-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: Row[];
  salesCashIn: number;
};

export default function CashFlowOperatingBreakdown({
  rows,
  salesCashIn,
}: Props) {
  const max = Math.max(...rows.map((r) => r.amount), 1);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          เงินสดจากการดำเนินงานไปไหน
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          สัดส่วนเทียบเงินสดรับจากขาย {formatBaht(salesCashIn)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 || salesCashIn === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูล
          </p>
        ) : (
          rows.map((row) => {
            const width = Math.min(100, (row.amount / max) * 100);
            return (
              <div key={row.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">
                    {row.label_th}
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {formatBaht(row.amount)}
                    {row.share_of_sales != null ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {(row.share_of_sales * 100).toFixed(1)}% ของขาย
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-600/80"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
