"use client";

import type { BiIncomeStatementBranchRow } from "@/lib/bi/income-statement-types";
import { formatBaht, labelFor, BRANCH_LABELS } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IncomeStatementBranchTableProps = {
  rows: BiIncomeStatementBranchRow[];
};

export default function IncomeStatementBranchTable({
  rows,
}: IncomeStatementBranchTableProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">แยกตามสาขา</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ไม่มีข้อมูลสาขา
          </p>
        ) : (
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">สาขา</th>
                <th className="py-2 pr-3 font-medium text-right">รายได้</th>
                <th className="py-2 pr-3 font-medium text-right">ซื้อสินค้า</th>
                <th className="py-2 pr-3 font-medium text-right">ค่าใช้จ่ายบริษัท</th>
                <th className="py-2 pr-3 font-medium text-right">ก่อนภาษี</th>
                <th className="py-2 pr-3 font-medium text-right">ภาษีเงินได้</th>
                <th className="py-2 font-medium text-right">สุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2.5 pr-3 font-medium text-slate-800">
                    {labelFor(BRANCH_LABELS, row.key)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.revenue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.purchase_cost)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.expense)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.profit_before_tax)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-rose-700">
                    {formatBaht(row.income_tax)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums">
                    {formatBaht(row.net_profit)}
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
