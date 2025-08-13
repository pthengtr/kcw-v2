// components/purchase/PurchaseFooter.tsx
"use client";

import { useContext } from "react";
import { PurchaseContext, PurchaseContextType } from "./PurchaseProvider";
import { Button } from "@/components/ui/button";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function PurchaseFooter() {
  const { subTotal, canSubmit, submitting, submit, submitError } = useContext(
    PurchaseContext
  ) as PurchaseContextType;

  return (
    <div className="flex flex-col items-center justify-between">
      <div className="text-sm text-destructive h-6">{submitError ?? ""}</div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">ยอดรวม</div>
          <div className="text-lg font-semibold tabular-nums">
            {money.format(subTotal)}
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
