"use client";

import type { BiStockMoreRow } from "@/lib/bi/product-movement-types";
import { formatCount } from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TableLoadingState from "@/components/common/TableLoadingState";

type Props = {
  rows: BiStockMoreRow[];
  loading?: boolean;
};

export default function StockMoreTable({ rows, loading = false }: Props) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          ควรสต็อกเพิ่ม — เคลื่อนออกมากสุด
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          เรียงตามจำนวนขาย (หน่วยเล็ก) ในช่วงที่เลือก · ซื้อ = HQ เสมอ
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          loading ? (
            <TableLoadingState />
          ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีสินค้าขายในช่วงนี้
          </p>
          )
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">สินค้า</th>
                <th className="py-2 pr-3 font-medium text-right">ขาย</th>
                <th className="py-2 pr-3 font-medium text-right">บิลขาย</th>
                <th className="py-2 pr-3 font-medium text-right">ซื้อ HQ</th>
                <th className="py-2 font-medium text-right">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.bcode} className="border-b border-slate-100">
                  <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-mono text-xs font-medium text-slate-900">
                      {row.bcode}
                    </div>
                    <div className="max-w-[16rem] truncate text-xs text-muted-foreground">
                      {row.detail}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.category_code} {row.category_name}
                      {row.code1_name ? ` · ${row.code1_name}` : null}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">
                    {formatCount(row.sell_qty)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatCount(row.sell_bills)}
                    <span className="text-[11px]"> / {row.sell_days} วัน</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatCount(row.buy_qty)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCount(row.on_hand_qty)}
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
