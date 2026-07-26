"use client";

import { useMemo, useState } from "react";

import {
  CUSTOMER_RANK_BRANCH_FILTERS,
  customerRankAmount,
} from "@/lib/bi/customer-rank-filter";
import type { BiCustomerRankRow } from "@/lib/bi/customer-types";
import {
  formatBaht,
  formatCount,
  shareOf,
} from "@/lib/bi/sales-format";
import type { BiBranchFilter } from "@/lib/bi/sales-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CustomerRankTableProps = {
  rows: BiCustomerRankRow[];
  totalRevenue: number;
  title?: string;
  description?: string;
  emptyLabel?: string;
  /** Chips drive API branch refetch when onBranchFilterChange is set. */
  branchFilter?: BiBranchFilter;
  onBranchFilterChange?: (branch: BiBranchFilter) => void;
};

export default function CustomerRankTable({
  rows,
  totalRevenue,
  title = "อันดับลูกค้า (ตามยอดสุทธิ)",
  description = "ชื่อจาก public.party เป็นหลัก · ไม่มีใน party แสดงรหัส ACCTNO / ชื่อจากบิล",
  emptyLabel = "ไม่มีข้อมูล",
  branchFilter = "ALL",
  onBranchFilterChange,
}: CustomerRankTableProps) {
  const [query, setQuery] = useState("");
  const showBranchFilter = onBranchFilterChange != null;
  const activeBranch = branchFilter;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.acctno,
        row.customer_name,
        row.bill_acctname ?? "",
        row.party_kind ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา ACCTNO / ชื่อลูกค้า…"
            className="w-full sm:max-w-xs"
            aria-label="ค้นหาลูกค้า"
          />
        </div>
        {showBranchFilter ? (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="กรองอันดับตามสาขา"
          >
            {CUSTOMER_RANK_BRANCH_FILTERS.map((option) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={activeBranch === option.key ? "default" : "outline"}
                className={cn(
                  activeBranch === option.key &&
                    "bg-slate-800 hover:bg-slate-700"
                )}
                onClick={() => onBranchFilterChange(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">ลูกค้า</th>
              <th className="py-2 pr-3 font-medium">Party</th>
              <th className="py-2 pr-3 text-right font-medium">
                {activeBranch === "ALL"
                  ? "ยอดสุทธิ"
                  : `ยอด ${activeBranch === "ONLINE" ? "ออนไลน์" : activeBranch}`}
              </th>
              <th className="py-2 pr-3 text-right font-medium">HQ</th>
              <th className="py-2 pr-3 text-right font-medium">SYP</th>
              <th className="py-2 pr-3 text-right font-medium">ออนไลน์</th>
              <th className="py-2 pr-3 text-right font-medium">บิล</th>
              <th className="py-2 pr-3 text-right font-medium">เฉลี่ย/บิล</th>
              <th className="py-2 text-right font-medium">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => {
                const amount = customerRankAmount(row, activeBranch);
                return (
                  <tr
                    key={row.acctno}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="whitespace-nowrap py-2.5 pr-2 text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="max-w-[16rem] py-2.5 pr-3">
                      <span className="block font-medium text-slate-900">
                        {row.acctno}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.customer_name}
                      </span>
                      {!row.in_party && row.bill_acctname ? (
                        <span className="block truncate text-[11px] text-amber-700">
                          ชื่อจากบิล: {row.bill_acctname}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs">
                      {row.in_party ? (
                        <span className="text-emerald-700">
                          {row.party_kind ?? "มีใน party"}
                        </span>
                      ) : (
                        <span className="text-amber-700">ยังไม่มีใน party</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums font-medium">
                      {formatBaht(amount)}
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
                      {formatCount(row.bill_count)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {formatBaht(row.avg_bill)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-muted-foreground">
                      {shareOf(amount, totalRevenue).toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
