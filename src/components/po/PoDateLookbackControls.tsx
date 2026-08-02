"use client";

import { Button } from "@/components/ui/button";
import { SSRDatePicker } from "@/components/common/SSRDatePicker";
import {
  PO_DATE_LOOKBACK_PRESETS,
  poDateRangeLookingBack,
} from "@/lib/po/format";

export function PoDateLookbackControls({
  from,
  to,
  lookbackId,
  onFromChange,
  onToChange,
  onLookbackIdChange,
  onRangeChange,
}: {
  from: string;
  to: string;
  lookbackId: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLookbackIdChange: (id: string) => void;
  onRangeChange: (range: { from: string; to: string }) => void;
}) {
  function applyLookback(id: string) {
    const item = PO_DATE_LOOKBACK_PRESETS.find((p) => p.id === id);
    if (!item) return;
    const range = poDateRangeLookingBack(item.preset);
    onLookbackIdChange(id);
    onRangeChange(range);
  }

  return (
    <>
      <SSRDatePicker
        name="from-date"
        placeholder="จากวันที่"
        value={from || undefined}
        onChange={(val) => {
          onLookbackIdChange("");
          onFromChange(val ?? "");
        }}
        className="sm:w-[180px]"
        clearable
      />
      <SSRDatePicker
        name="to-date"
        placeholder="ถึงวันที่"
        value={to || undefined}
        onChange={(val) => {
          onLookbackIdChange("");
          onToChange(val ?? "");
        }}
        className="sm:w-[180px]"
        clearable
      />
      <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
        {PO_DATE_LOOKBACK_PRESETS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={lookbackId === item.id ? "default" : "outline"}
            onClick={() => applyLookback(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </>
  );
}
