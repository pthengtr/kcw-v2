"use client";

import type {
  BiDeadSort,
  BiDeadStockRow,
  BiDeadTier,
} from "@/lib/bi/product-movement-types";
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
  sort: BiDeadSort;
  loading?: boolean;
  onSortChange: (sort: BiDeadSort) => void;
  onPrev: () => void;
  onNext: () => void;
};

const TIER_LABEL: Record<BiDeadTier, string> = {
  yellow: "≥6 เดือน",
  orange: "≥1 ปี",
  red: "≥2 ปี",
};

const ROW_TONE: Record<BiDeadTier, string> = {
  yellow: "border-l-[3px] border-l-amber-400 bg-amber-50/80",
  orange: "border-l-[3px] border-l-orange-500 bg-orange-50/80",
  red: "border-l-[3px] border-l-rose-600 bg-rose-50/85",
};

const TIER_BADGE: Record<BiDeadTier, string> = {
  yellow: "bg-amber-100 text-amber-950",
  orange: "bg-orange-100 text-orange-950",
  red: "bg-rose-100 text-rose-950",
};

function ageLabel(days: number | null) {
  if (days == null) return "—";
  const months = Math.floor(days / 30);
  if (months >= 24) {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years} ปี ${rem} ด.` : `${years} ปี`;
  }
  if (months >= 1) return `${months} เดือน`;
  return `${formatCount(days)} วัน`;
}

export default function DeadStockTable({
  rows,
  totalCount,
  offset,
  pageSize,
  hasMore,
  sort,
  loading,
  onSortChange,
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
              สต็อกค้าง — อายุจากวันซื้อล่าสุดที่ยังไม่ขายต่อ
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              มีคงเหลือ · เริ่มเตือนตั้งแต่ 6 เดือน · เหลือง ≥6 ด. / ส้ม ≥1 ปี /
              แดง ≥2 ปี · ไม่ใช้ช่วงขาย/สาขา
            </p>
          </div>
          {pager}
        </div>

        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="ทิศทางเรียงสต็อกค้าง"
        >
          <Button
            type="button"
            size="sm"
            variant={sort === "deep" ? "default" : "outline"}
            className={cn(sort === "deep" && "bg-slate-800 hover:bg-slate-700")}
            onClick={() => onSortChange("deep")}
            disabled={loading}
          >
            ค้างนานก่อน (2 ปี+ →)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "recent" ? "default" : "outline"}
            className={cn(
              sort === "recent" && "bg-slate-800 hover:bg-slate-700"
            )}
            onClick={() => onSortChange("recent")}
            disabled={loading}
          >
            เพิ่งเข้าเกณฑ์ (6 ด. →)
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีรายการสต็อกค้าง (≥6 เดือนหลังซื้อโดยยังไม่ขาย)
          </p>
        ) : (
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">ระดับ</th>
                <th className="py-2 pr-3 font-medium">สินค้า</th>
                <th className="py-2 pr-3 font-medium">หมวด</th>
                <th className="py-2 pr-3 font-medium">ซื้อล่าสุด</th>
                <th className="py-2 pr-3 font-medium">ขายล่าสุด</th>
                <th className="py-2 pr-3 font-medium text-right">อายุหลังซื้อ</th>
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
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        TIER_BADGE[row.dead_tier]
                      )}
                    >
                      {TIER_LABEL[row.dead_tier]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="font-mono text-xs font-medium text-slate-900">
                      {row.bcode}
                    </div>
                    <div className="max-w-[16rem] truncate text-xs text-muted-foreground">
                      {row.detail}
                    </div>
                  </td>
                  <td className="max-w-[9rem] truncate py-2.5 pr-3 text-xs text-muted-foreground">
                    {row.category_name || row.category_code || "—"}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums text-xs">
                    {row.last_purchase_date ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums text-xs">
                    {row.last_sale_date ?? "ไม่เคยขาย"}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <div className="font-medium tabular-nums text-slate-900">
                      {ageLabel(row.days_since_purchase)}
                    </div>
                    {row.days_since_purchase != null ? (
                      <div className="text-[11px] tabular-nums text-muted-foreground">
                        {formatCount(row.days_since_purchase)} วัน
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {formatCount(row.on_hand_qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {sort === "deep"
              ? "เรียงแดง → ส้ม → เหลือง (อายุมากก่อน)"
              : "เรียงเหลือง → ส้ม → แดง (เพิ่งเข้าเกณฑ์ก่อน)"}{" "}
            · หน้าละ {formatCount(pageSize)}
          </p>
          {pager}
        </div>
      </CardContent>
    </Card>
  );
}
