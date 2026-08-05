"use client";

import type { BiVatBranchRow } from "@/lib/bi/vat-types";
import {
  BRANCH_LABELS,
  formatBaht,
  labelFor,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VatBranchTableProps = {
  rows: BiVatBranchRow[];
};

export default function VatBranchTable({ rows }: VatBranchTableProps) {
  const sorted = [...rows].sort((a, b) => b.net_vat - a.net_vat);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          ตามสาขา (HQ / SYP)
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
                <th className="py-2 pr-3 font-medium text-right">ภาษีขาย</th>
                <th className="py-2 pr-3 font-medium text-right">ภาษีซื้อ</th>
                <th className="py-2 pr-3 font-medium text-right">
                  ภาษีซื้อ (ค่าใช้จ่าย)
                </th>
                <th className="py-2 font-medium text-right">ภาษีสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {labelFor(BRANCH_LABELS, row.key)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.sales_vat)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.purchase_vat)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.expense_vat)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-slate-900">
                    {formatBaht(row.net_vat)}
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
