"use client";

import type { BiCashflowStatementRow } from "@/lib/bi/cashflow-dashboard-types";
import { formatBaht } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTH_TH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

type Props = {
  rows: BiCashflowStatementRow[];
  onCellClick?: (args: {
    code: string;
    month: number;
    amount: number;
    label: string;
  }) => void;
};

function AmountCell({
  value,
  emphasize,
  clickable,
  onClick,
}: {
  value: number | null | undefined;
  emphasize?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  if (value == null) {
    return (
      <td className="whitespace-nowrap px-2 py-2 text-right text-muted-foreground">
        —
      </td>
    );
  }
  const negative = value < 0;
  const positive = value > 0;
  return (
    <td className="whitespace-nowrap px-2 py-2 text-right">
      <button
        type="button"
        disabled={!clickable}
        onClick={onClick}
        className={cn(
          "tabular-nums",
          emphasize && "font-semibold",
          negative && "text-rose-700",
          positive && emphasize && "text-emerald-700",
          clickable &&
            "rounded px-1 hover:bg-slate-100 hover:underline disabled:hover:no-underline"
        )}
      >
        {formatBaht(value)}
      </button>
    </td>
  );
}

export default function CashFlowStatementTable({ rows, onCellClick }: Props) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          งบกระแสเงินสด
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          คลิกตัวเลขรายเดือนของบรรทัดรหัสเพื่อดูรายการธนาคารที่เกี่ยวข้อง
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-white py-2 pr-3 text-left font-medium">
                รายการ
              </th>
              {MONTH_TH.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">YTD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "section") {
                return (
                  <tr key={row.key} className="bg-slate-50/80">
                    <td
                      colSpan={14}
                      className="sticky left-0 bg-slate-50/80 px-0 py-2.5 pl-0 font-semibold text-slate-900"
                    >
                      {row.label_th}
                    </td>
                  </tr>
                );
              }

              const emphasize =
                row.kind === "subtotal" ||
                row.kind === "total" ||
                row.kind === "balance";
              const clickable = row.kind === "line" && !!row.code;

              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-slate-100",
                    emphasize && "bg-slate-50/40"
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 bg-white py-2 pr-3",
                      emphasize && "bg-slate-50 font-semibold text-slate-900"
                    )}
                  >
                    <span className={cn(!emphasize && "pl-3 text-slate-700")}>
                      {row.label_th}
                      {row.code ? (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {row.code}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    const raw = row.months?.[String(month)];
                    const signed =
                      raw == null
                        ? null
                        : row.sign === -1
                          ? -Math.abs(raw)
                          : raw;
                    return (
                      <AmountCell
                        key={month}
                        value={signed}
                        emphasize={emphasize}
                        clickable={clickable && raw != null && raw !== 0}
                        onClick={() => {
                          if (!row.code || raw == null) return;
                          onCellClick?.({
                            code: row.code,
                            month,
                            amount: raw,
                            label: row.label_th,
                          });
                        }}
                      />
                    );
                  })}
                  <AmountCell
                    value={
                      row.ytd == null
                        ? null
                        : row.sign === -1
                          ? -Math.abs(row.ytd)
                          : row.ytd
                    }
                    emphasize
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
