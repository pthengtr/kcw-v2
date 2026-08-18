"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { BiProductRankRow } from "@/lib/bi/product-types";
import {
  formatBaht,
  formatCount,
  shareOf,
} from "@/lib/bi/sales-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProductRankTableProps = {
  rows: BiProductRankRow[];
  totalRevenue: number;
};

export default function ProductRankTable({
  rows,
  totalRevenue,
}: ProductRankTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.bcode,
        row.detail,
        row.category_code,
        row.category_name,
        row.code1 ?? "",
        row.code1_name ?? "",
        row.pcode ?? "",
        row.mcode ?? "",
        row.brand ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">
            อันดับสินค้า (ตามยอดสุทธิ)
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            จำนวนเป็นหน่วยเล็กสุด (QTY × MTP) · คงเหลือจาก HQ ICMAS (QTYOH2)
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา BCODE / ชื่อ / หมวด / เบอร์แท้…"
          className="w-full sm:max-w-xs"
          aria-label="ค้นหาสินค้า"
        />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">สินค้า</th>
              <th className="py-2 pr-3 font-medium">หมวด</th>
              <th className="py-2 pr-3 font-medium">ชนิด</th>
              <th className="py-2 pr-3 text-right font-medium">ยอดสุทธิ</th>
              <th className="py-2 pr-3 text-right font-medium">HQ</th>
              <th className="py-2 pr-3 text-right font-medium">SYP</th>
              <th className="py-2 pr-3 text-right font-medium">ออนไลน์</th>
              <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
              <th className="py-2 pr-3 text-right font-medium">คงเหลือ</th>
              <th className="py-2 text-right font-medium">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="py-8 text-center text-muted-foreground"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={row.bcode}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="whitespace-nowrap py-2.5 pr-2 text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="max-w-[14rem] py-2.5 pr-3">
                    <Link
                      href={`/bi/product-sales?bcode=${encodeURIComponent(row.bcode)}`}
                      className="block font-medium text-slate-900 hover:underline"
                    >
                      {row.bcode}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.detail}
                    </span>
                  </td>
                  <td className="max-w-[10rem] py-2.5 pr-3">
                    <span className="block whitespace-nowrap text-xs text-slate-500">
                      {row.category_code}
                    </span>
                    <span className="block truncate text-xs text-slate-700">
                      {row.category_name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-slate-700">
                    {row.code1_name
                      ? `${row.code1} · ${row.code1_name}`
                      : row.code1 ?? "—"}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums font-medium">
                    {formatBaht(row.revenue_net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatBaht(row.hq_revenue_net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatBaht(row.syp_revenue_net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatBaht(row.online_revenue_net)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                    {formatCount(row.base_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatCount(row.on_hand_qty)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-muted-foreground">
                    {shareOf(row.revenue_net, totalRevenue).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
