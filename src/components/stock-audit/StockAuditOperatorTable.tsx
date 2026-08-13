"use client";

import { formatCount } from "@/lib/bi/sales-format";
import {
  STOCK_WORK_EVENT_META,
  type StockWorkOperator,
} from "@/lib/stock-audit/work-types";

type Props = {
  rows: StockWorkOperator[];
};

export default function StockAuditOperatorTable({ rows }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">ผู้ปฏิบัติงาน (สาขา)</h2>
        <p className="text-xs text-muted-foreground">
          จาก stock.work_event · วันนี้ / 7 วัน (นับตรง+คลาด = งานนับเสร็จ)
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          ยังไม่มีงานตรวจใน 7 วันที่ผ่านมา
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">ชื่อ</th>
                <th className="pb-2 pr-2 text-right font-medium">นับเสร็จวันนี้</th>
                {STOCK_WORK_EVENT_META.map((m) => (
                  <th key={m.key} className="pb-2 pr-2 text-right font-medium">
                    {m.label}
                  </th>
                ))}
                <th className="pb-2 text-right font-medium">7 วัน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.line_user_id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-2.5 pr-3 font-medium text-slate-800">
                    {row.display_name}
                  </td>
                  <td className="py-2.5 pr-2 text-right tabular-nums font-semibold text-slate-800">
                    {formatCount(row.today.completed_counts)}
                  </td>
                  {STOCK_WORK_EVENT_META.map((m) => (
                    <td
                      key={m.key}
                      className="py-2.5 pr-2 text-right tabular-nums text-slate-700"
                    >
                      {formatCount(row.today[m.key])}
                    </td>
                  ))}
                  <td className="py-2.5 text-right tabular-nums text-slate-700">
                    {formatCount(row.week.completed_counts)}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({formatCount(row.week.total_actions)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
