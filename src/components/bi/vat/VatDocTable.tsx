"use client";

import type { BiVatDocRow } from "@/lib/bi/vat-types";
import {
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  labelFor,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VatDocTableProps = {
  title: string;
  rows: BiVatDocRow[];
  showBranch?: boolean;
  emptyText?: string;
};

export default function VatDocTable({
  title,
  rows,
  showBranch = false,
  emptyText = "ไม่มีรายการ",
}: VatDocTableProps) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.tax) - Math.abs(a.tax));

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">ประเภท</th>
                {showBranch ? (
                  <th className="py-2 pr-3 font-medium">สาขา</th>
                ) : null}
                <th className="py-2 pr-3 font-medium text-right">บิล</th>
                <th className="py-2 pr-3 font-medium text-right">มูลค่าสินค้า</th>
                <th className="py-2 pr-3 font-medium text-right">ภาษีมูลค่าเพิ่ม</th>
                <th className="py-2 font-medium text-right">ยอดสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={`${row.branch ?? ""}-${row.key}`}
                  className="border-b border-slate-100"
                >
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {row.key}
                  </td>
                  {showBranch ? (
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {labelFor(BRANCH_LABELS, row.branch ?? "")}
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatCount(row.bill_count)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatBaht(row.beforetax)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-medium">
                    {formatBaht(row.tax)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatBaht(row.aftertax)}
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
