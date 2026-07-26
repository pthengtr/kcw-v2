"use client";

import type { BiIncomeBranchRow } from "@/lib/bi/income-types";
import {
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  labelFor,
  shareOf,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IncomeBranchTableProps = {
  rows: BiIncomeBranchRow[];
};

export default function IncomeBranchTable({ rows }: IncomeBranchTableProps) {
  const sorted = [...rows].sort((a, b) => b.net_income - a.net_income);
  const revenueTotal = sorted.reduce((s, r) => s + r.revenue_net, 0);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          ตามสาขา (HQ / SYP / ออนไลน์)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลสาขา
          </p>
        ) : (
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">สาขา</th>
                <th className="py-2 pr-3 font-medium text-right">ยอดขาย</th>
                <th className="py-2 pr-3 font-medium text-right">ต้นทุน</th>
                <th className="py-2 pr-3 font-medium text-right">ขั้นต้น</th>
                <th className="py-2 pr-3 font-medium text-right">ค่าใช้จ่าย</th>
                <th className="py-2 font-medium text-right">สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-slate-900">
                      {labelFor(BRANCH_LABELS, row.key)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCount(row.bill_count)} บิล ·{" "}
                      {shareOf(row.revenue_net, revenueTotal).toFixed(0)}%
                      ยอดขาย
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.revenue_net)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.cogs)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.gross_profit)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.opex)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {formatBaht(row.net_income)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
