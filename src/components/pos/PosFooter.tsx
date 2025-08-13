"use client";

import { useContext } from "react";
import { PosContext, PosContextType } from "./PosProvider";
import { Button } from "@/components/ui/button";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function PosFooter() {
  const {
    totalBeforeTax,
    vatTotal,
    grandTotal,
    paidTotal,
    changeDue,
    canSubmit,
    submitting,
    submit,
    submitError,
  } = useContext(PosContext) as PosContextType;

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="text-sm text-destructive h-6">{submitError ?? ""}</div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">ก่อน VAT</div>
          <div className="text-lg font-semibold tabular-nums">
            {money.format(totalBeforeTax)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">VAT</div>
          <div className="text-lg font-semibold tabular-nums">
            {money.format(vatTotal)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">รวมทั้งสิ้น</div>
          <div className="text-lg font-semibold tabular-nums">
            {money.format(grandTotal)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">ชำระแล้ว</div>
          <div className="text-lg font-semibold tabular-nums">
            {money.format(paidTotal)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">เงินทอน</div>
          <div className="text-lg font-semibold tabular-nums">
            {money.format(Math.max(0, changeDue))}
          </div>
        </div>
        <Button
          disabled={!canSubmit || submitting}
          onClick={async () => await submit()}
        >
          {submitting ? "กำลังบันทึก…" : "บันทึกการขาย"}
        </Button>
      </div>
    </div>
  );
}
