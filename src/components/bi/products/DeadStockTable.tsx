"use client";

import type { BiDeadStockRow, BiDeadTier } from "@/lib/bi/product-movement-types";
import { formatCount } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  rows: BiDeadStockRow[];
  totalCount: number;
  offset: number;
  pageSize: number;
  hasMore: boolean;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

const TIER_LABEL: Record<BiDeadTier, string> = {
  yellow: "≥3 เดือน",
  orange: "≥6 เดือน",
  red: "≥1 ปี",
};

const ROW_TONE: Record<BiDeadTier, string> = {
  yellow: "bg-amber-50/90",
  orange: "bg-orange-50/90",
  red: "bg-rose-50/90",
};

const TIER_BADGE: Record<BiDeadTier, string> = {
  yellow: "bg-amber-100 text-amber-900",
  orange: "bg-orange-100 text-orange-900",
  red: "bg-rose-100 text-rose-900",
};

export default function DeadStockTable({
  rows,
  totalCount,
  offset,
  pageSize,
  hasMore,
  loading,
  onPrev,
  onNext,
}: Props) {
  const fromRow = totalCount === 0 ? 0 : offset + 1;
  const toRow = offset + rows.length;
  const canPrev = offset > 0;

  const pager = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        แสดง {formatCount(fromRow)}–{formatCount(toRow)} จาก{" "}
        {formatCount(totalCount)}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onPrev}
        disabled={!canPrev || loading}
      >
        ก่อนหน้า
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onNext}
        disabled={!hasMore || loading}
      >
        ถัดไป
      </Button>
    </div>
  );

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              สต็อกค้าง / ระวังก่อนสั่ง — ตามอายุซื้อล่าสุด
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              มีคงเหลือ · เรียง 3 เดือน → 6 เดือน → 1 ปี+ (อายุน้อยก่อนในแต่ละช่วง)
              · ไฮไลท์แถวตามระดับ · ซื้ออ้างอิง HQ
            </p>
          </div>
          {pager}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีรายการสต็อกค้าง
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
              {rows.map((row) => (
                <tr
                  key={row.bcode}
                  className={cn(
                    "border-b border-slate-100/80",
                    ROW_TONE[row.dead_tier]
                  )}
                >
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
                        TIER_BADGE[row.dead_tier]
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-muted-foreground">
            เหลือง ≥3 ด. · ส้ม ≥6 ด. · แดง ≥1 ปี · หน้าละ {formatCount(pageSize)}
          </p>
          {pager}
        </div>
      </CardContent>
    </Card>
  );
}
