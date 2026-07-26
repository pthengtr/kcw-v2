"use client";

import type {
  BiDeadStockRow,
  BiDeadTier,
} from "@/lib/bi/product-movement-types";
import { formatCount } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: BiDeadStockRow[];
  tierFilter: "ALL" | BiDeadTier;
};

const TIER_STYLE: Record<BiDeadTier, string> = {
  yellow: "bg-amber-100 text-amber-900",
  orange: "bg-orange-100 text-orange-900",
  red: "bg-rose-100 text-rose-900",
};

const TIER_LABEL: Record<BiDeadTier, string> = {
  yellow: "≥3 เดือน",
  orange: "≥6 เดือน",
  red: "≥1 ปี",
};

export default function DeadStockTable({ rows, tierFilter }: Props) {
  const filtered =
    tierFilter === "ALL"
      ? rows
      : rows.filter((r) => r.dead_tier === tierFilter);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          สต็อกค้าง / ระวังก่อนสั่ง — ตามอายุซื้อล่าสุด
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          มีคงเหลือ · ไม่มีการขายหลังซื้อล่าสุด หรือไม่ขายในช่วง 3/6/12 เดือน ·
          ซื้ออ้างอิง HQ
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีรายการในกลุ่มนี้
          </p>
        ) : (
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">ระดับ</th>
                <th className="py-2 pr-3 font-medium">สินค้า</th>
                <th className="py-2 pr-3 font-medium">ซื้อล่าสุด</th>
                <th className="py-2 pr-3 font-medium">ขายล่าสุด</th>
                <th className="py-2 pr-3 font-medium text-right">วันหลังซื้อ</th>
                <th className="py-2 font-medium text-right">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.bcode} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
                        TIER_STYLE[row.dead_tier]
                      )}
                    >
                      {TIER_LABEL[row.dead_tier]}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-mono text-xs font-medium text-slate-900">
                      {row.bcode}
                    </div>
                    <div className="max-w-[16rem] truncate text-xs text-muted-foreground">
                      {row.detail}
                    </div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-xs">
                    {row.last_purchase_date ?? "—"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-xs">
                    {row.last_sale_date ?? "ไม่เคยขาย"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.days_since_purchase != null
                      ? formatCount(row.days_since_purchase)
                      : "—"}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
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
