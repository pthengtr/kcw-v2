"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  BiDeadSort,
  BiDeadStockRow,
  BiDeadTier,
} from "@/lib/bi/product-movement-types";
import { CATEGORY_LABELS } from "@/lib/bi/icmas-labels";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  rows: BiDeadStockRow[];
  totalCount: number;
  categoryTotal: number;
  stockValue: number;
  categoryStockValue: number;
  tierCounts: { yellow: number; orange: number; red: number };
  offset: number;
  pageSize: number;
  hasMore: boolean;
  sort: BiDeadSort;
  tierFilter: BiDeadTier | "ALL";
  category: string | null;
  loading?: boolean;
  onSortChange: (sort: BiDeadSort) => void;
  onTierChange: (tier: BiDeadTier | "ALL") => void;
  onCategoryChange: (category: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpPage: (page: number) => void;
};

const SORT_OPTIONS: { value: BiDeadSort; label: string }[] = [
  { value: "value_desc", label: "มูลค่าสต๊อกสูงก่อน" },
  { value: "deep", label: "ค้างนานก่อน (อายุ)" },
  { value: "recent", label: "เพิ่งเข้าเกณฑ์ (อายุ)" },
  { value: "qty_desc", label: "คงเหลือมากก่อน" },
  { value: "cost_desc", label: "ทุนต่อหน่วยสูงก่อน" },
  { value: "value_asc", label: "มูลค่าสต๊อกต่ำก่อน" },
];

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
  categoryTotal,
  stockValue,
  categoryStockValue,
  tierCounts,
  offset,
  pageSize,
  hasMore,
  sort,
  tierFilter,
  category,
  loading,
  onSortChange,
  onTierChange,
  onCategoryChange,
  onPrev,
  onNext,
  onJumpPage,
}: Props) {
  const fromRow = totalCount === 0 ? 0 : offset + 1;
  const toRow = offset + rows.length;
  const canPrev = offset > 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const currentPage =
    totalCount === 0 ? 1 : Math.floor(offset / pageSize) + 1;

  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const categoryOptions = useMemo(
    () =>
      Object.entries(CATEGORY_LABELS)
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    []
  );

  const jumpToInput = () => {
    const n = Number(pageInput);
    if (!Number.isFinite(n)) {
      setPageInput(String(currentPage));
      return;
    }
    const page = Math.min(totalPages, Math.max(1, Math.trunc(n)));
    setPageInput(String(page));
    onJumpPage(page);
  };

  const pager = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        แสดง {formatCount(fromRow)}–{formatCount(toRow)} จาก{" "}
        {formatCount(totalCount)}
        {" · "}
        หน้า {formatCount(currentPage)}/{formatCount(totalPages)}
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
      <div className="flex items-center gap-1">
        <Label htmlFor="bi-dead-page" className="sr-only">
          ไปหน้า
        </Label>
        <input
          id="bi-dead-page"
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              jumpToInput();
            }
          }}
          disabled={loading || totalCount === 0}
          className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={jumpToInput}
          disabled={loading || totalCount === 0}
        >
          ไปหน้า
        </Button>
      </div>
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
              ทุนจาก ICMAS COSTLAST · มูลค่า = คงเหลือ × ทุน · กรองหมวดเดียวช่วยให้โหลดเร็ว
              · ในหมวดนี้ {formatCount(categoryTotal)} รายการ (
              {formatBaht(categoryStockValue, true)})
            </p>
          </div>
          {pager}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bi-dead-category">หมวดสินค้า (เลือกทีละหมวด)</Label>
            <Select
              value={category ?? "ALL"}
              onValueChange={(v) =>
                onCategoryChange(v === "ALL" ? null : v)
              }
              disabled={loading}
            >
              <SelectTrigger id="bi-dead-category" className="w-full">
                <SelectValue placeholder="ทุกหมวด" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ALL">ทุกหมวด</SelectItem>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.code} — {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bi-dead-sort">เรียงตาม</Label>
            <Select
              value={sort}
              onValueChange={(v) => onSortChange(v as BiDeadSort)}
              disabled={loading}
            >
              <SelectTrigger id="bi-dead-sort" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="กรองระดับอายุ"
        >
          {(
            [
              ["ALL", "ทั้งหมด", categoryTotal],
              ["yellow", TIER_LABEL.yellow, tierCounts.yellow],
              ["orange", TIER_LABEL.orange, tierCounts.orange],
              ["red", TIER_LABEL.red, tierCounts.red],
            ] as const
          ).map(([key, label, count]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={tierFilter === key ? "default" : "outline"}
              className={cn(
                tierFilter === key && "bg-slate-800 hover:bg-slate-700"
              )}
              onClick={() => onTierChange(key)}
              disabled={loading}
            >
              {label} ({formatCount(count)})
            </Button>
          ))}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          มูลค่าตามตัวกรองปัจจุบัน{" "}
          <span className="font-medium text-slate-800">
            {formatBaht(stockValue, true)}
          </span>
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            ไม่มีรายการตามตัวกรองนี้
          </p>
        ) : (
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">ระดับ</th>
                <th className="py-2 pr-3 font-medium">สินค้า</th>
                <th className="py-2 pr-3 font-medium">หมวด</th>
                <th className="py-2 pr-3 font-medium">ซื้อล่าสุด</th>
                <th className="py-2 pr-3 font-medium text-right">อายุ</th>
                <th className="py-2 pr-3 font-medium text-right">คงเหลือ</th>
                <th className="py-2 pr-3 font-medium text-right">ทุน/หน่วย</th>
                <th className="py-2 font-medium text-right">มูลค่าสต๊อก</th>
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
                  <td className="py-2.5 pr-3 text-right">
                    <div className="font-medium tabular-nums text-slate-900">
                      {ageLabel(row.days_since_purchase)}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatCount(row.on_hand_qty)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-900">
                    {row.unit_cost == null
                      ? "—"
                      : formatBaht(row.unit_cost, true)}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {row.unit_cost == null
                      ? "—"
                      : formatBaht(row.stock_value, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort} · หน้าละ{" "}
            {formatCount(pageSize)} · ไม่มีทุน = ไม่คิดมูลค่า
          </p>
          {pager}
        </div>
      </CardContent>
    </Card>
  );
}
