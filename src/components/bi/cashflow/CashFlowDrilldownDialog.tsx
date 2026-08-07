"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { BiCashflowDrilldown } from "@/lib/bi/cashflow-dashboard-types";
import { formatBaht } from "@/lib/bi/sales-format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  code: string;
  label: string;
};

export default function CashFlowDrilldownDialog({
  open,
  onOpenChange,
  year,
  month,
  code,
  label,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BiCashflowDrilldown | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      code,
      limit: "200",
    });

    void fetch(`/api/bi/cashflow/drilldown?${params}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          drilldown?: BiCashflowDrilldown;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "โหลดรายการไม่สำเร็จ");
        if (!json.drilldown) throw new Error("ไม่มีข้อมูล");
        if (!cancelled) setData(json.drilldown);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, year, month, code]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base">
            {label} · {month}/{year} · {code}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังโหลดรายการ…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {data ? (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">วันที่</th>
                  <th className="py-2 pr-2 font-medium">รายละเอียด</th>
                  <th className="py-2 pr-2 font-medium">บัญชี</th>
                  <th className="py-2 pr-2 font-medium">หมวดจับคู่</th>
                  <th className="py-2 pr-2 font-medium">อ้างอิง</th>
                  <th className="py-2 text-right font-medium">ยอด</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      ไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  data.lines.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="whitespace-nowrap py-2 pr-2 text-slate-600">
                        {line.transaction_date}
                      </td>
                      <td className="max-w-[14rem] truncate py-2 pr-2">
                        {line.description}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-slate-600">
                        {line.account_no}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-slate-600">
                        {line.matched_ref_type ?? "—"}
                      </td>
                      <td className="max-w-[8rem] truncate py-2 pr-2 text-slate-600">
                        {line.reference ?? "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right tabular-nums font-medium">
                        {formatBaht(line.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
