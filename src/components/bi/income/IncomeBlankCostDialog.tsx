"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { BiIncomeBlankCosts } from "@/lib/bi/income-types";
import {
  BRANCH_LABELS,
  formatBaht,
  formatCount,
  labelFor,
} from "@/lib/bi/sales-format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type IncomeBlankCostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: string;
  to: string;
  branch: string | null;
  expectedCount: number;
};

export default function IncomeBlankCostDialog({
  open,
  onOpenChange,
  from,
  to,
  branch,
  expectedCount,
}: IncomeBlankCostDialogProps) {
  const [data, setData] = useState<BiIncomeBlankCosts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, limit: "500" });
      if (branch) params.set("branch", branch);
      const res = await fetch(
        `/api/bi/income/blank-costs?${params.toString()}`
      );
      const json = (await res.json()) as {
        blankCosts?: BiIncomeBlankCosts;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "โหลดรายการไม่สำเร็จ");
      }
      if (!json.blankCosts) {
        throw new Error("ไม่มีข้อมูล");
      }
      setData(json.blankCosts);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to, branch]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,44rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>บรรทัดที่ไม่มีต้นทุนซื้อล่าสุด</DialogTitle>
          <DialogDescription>
            LAST_PURCHASE_COST ว่าง → ตัดออกจากคำนวณกำไร · คาด{" "}
            {formatCount(expectedCount)} บรรทัดในช่วงที่เลือก
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {error}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => void load()}
            >
              ลองใหม่
            </Button>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังโหลดรายการ…
          </div>
        ) : null}

        {data ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              แสดง {formatCount(data.returned_count)} จาก{" "}
              {formatCount(data.total_count)} บรรทัด
              {data.truncated ? " (ตัดตาม limit)" : null}
            </p>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">วันที่</th>
                    <th className="px-3 py-2 font-medium">บิล</th>
                    <th className="px-3 py-2 font-medium">สาขา</th>
                    <th className="px-3 py-2 font-medium">BCODE</th>
                    <th className="px-3 py-2 font-medium">รายละเอียด</th>
                    <th className="px-3 py-2 font-medium text-right">QTY</th>
                    <th className="px-3 py-2 font-medium text-right">ยอดบรรทัด</th>
                    <th className="px-3 py-2 font-medium">COST_STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        ไม่พบบรรทัดต้นทุนว่าง
                      </td>
                    </tr>
                  ) : (
                    data.lines.map((row, i) => (
                      <tr
                        key={`${row.store_branch}-${row.bill_no}-${row.bcode}-${i}`}
                        className="border-b border-slate-100"
                      >
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                          {row.bill_date}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">
                          {row.bill_no}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {labelFor(BRANCH_LABELS, row.reporting_branch)}
                          {row.store_branch !== row.reporting_branch ? (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              ({row.store_branch})
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                          {row.bcode || "—"}
                        </td>
                        <td
                          className="max-w-[14rem] truncate px-3 py-2"
                          title={row.detail}
                        >
                          {row.detail || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.qty}
                          {row.mtp !== 1 ? (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              ×{row.mtp}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatBaht(row.amount_gross)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                          {row.cost_status || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
