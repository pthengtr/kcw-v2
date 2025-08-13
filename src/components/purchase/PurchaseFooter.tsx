"use client";

import { useContext } from "react";
import { PurchaseContext, PurchaseContextType } from "./PurchaseProvider";
import { Button } from "@/components/ui/button";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function PurchaseFooter() {
  const {
    totalBeforeTax,
    vatTotal,
    grandTotal,
    canSubmit,
    submitting,
    submit,
    submitError,
  } = useContext(PurchaseContext) as PurchaseContextType;

  return (
    <div className="flex flex-col items-center justify-between">
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
        <Button
          disabled={!canSubmit || submitting}
          onClick={async () => await submit()}
        >
          {submitting ? "กำลังบันทึก…" : "บันทึก & ตัดสต็อก"}
        </Button>
      </div>
    </div>
  );
}
