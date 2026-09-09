"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExpenseGeneralType, ExpenseReceiptType } from "@/lib/types/models";
import { parseOffsetSummary } from "@/lib/expense/personal-offset";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ExpenseReceiptLinkedOffsets({
  receipt,
}: {
  receipt: ExpenseReceiptType;
}) {
  const [rows, setRows] = useState<ExpenseGeneralType[]>([]);
  const [claimed, setClaimed] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("expense_general")
      .select(
        "*, expense_item(*), payment_method(*), branch(*), expense_receipt:ref_receipt_uuid(receipt_uuid, receipt_number)"
      )
      .eq("ref_receipt_uuid", receipt.receipt_uuid)
      .order("entry_date", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as ExpenseGeneralType[]);
      });
    void supabase
      .rpc("fn_expense_receipt_offset_summary", {
        p_receipt: receipt.receipt_uuid,
        p_exclude: null,
      })
      .then(({ data }) => {
        const summary = parseOffsetSummary(data);
        setClaimed(summary.claimed_opex);
        setRemaining(summary.remaining);
      });
  }, [receipt.receipt_uuid]);

  const offsetTotal = rows.reduce(
    (sum, row) => sum + row.unit_price * row.quantity,
    0
  );

  return (
    <div className="grid w-full grid-cols-1 gap-2 rounded-md border p-4 sm:p-8">
      <div className="col-span-full text-sm font-semibold">หักส่วนตัวจากบิลนี้</div>
      {rows.length === 0 ? (
        <div className="col-span-full text-sm text-muted-foreground">
          ยังไม่มีรายการหักในค่าใช้จ่ายทั่วไป
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.general_uuid}
            className="col-span-full flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate">
              {row.description || row.expense_item?.item_name}
            </span>
            <span className="shrink-0 tabular-nums text-rose-700">
              {formatBaht(row.unit_price * row.quantity)}
            </span>
          </div>
        ))
      )}
      {claimed != null ? (
        <>
          <div className="text-sm text-muted-foreground">ยอดที่เคลมไว้</div>
          <div className="text-right tabular-nums">{formatBaht(claimed)}</div>
          <div className="text-sm text-muted-foreground">หักส่วนตัวรวม</div>
          <div className="text-right tabular-nums text-rose-700">
            {formatBaht(offsetTotal)}
          </div>
          <div className="font-medium">ใช้จริงของบริษัท</div>
          <div className="text-right font-medium tabular-nums">
            {formatBaht(remaining ?? claimed + offsetTotal)}
          </div>
        </>
      ) : null}
    </div>
  );
}
