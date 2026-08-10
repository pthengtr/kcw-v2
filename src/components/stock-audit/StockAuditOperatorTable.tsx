"use client";

import { formatCount } from "@/lib/bi/sales-format";
import type { StockAuditOperatorMark } from "@/lib/stock-audit/types";

type Props = {
  rows: StockAuditOperatorMark[];
};

export default function StockAuditOperatorTable({ rows }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">ผู้ตรวจ (สาขา)</h2>
        <p className="text-xs text-muted-foreground">
          จากเหตุการณ์ตรวจนับที่ซิงก์ขึ้นมา · วันนี้ / 7 วัน
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          ยังไม่มีรายการตรวจใน 7 วันที่ผ่านมา
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">ชื่อ</th>
                <th className="pb-2 pr-3 text-right font-medium">วันนี้</th>
                <th className="pb-2 text-right font-medium">7 วัน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-2.5 pr-3 font-medium text-slate-800">
                    {row.name}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                    {formatCount(row.today_count)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">
                    {formatCount(row.week_count)}
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
