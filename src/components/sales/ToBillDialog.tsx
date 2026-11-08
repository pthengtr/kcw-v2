"use client";

import { useEffect, useState } from "react";

import DialogPrintButton from "@/components/common/DialogPrintButton";
import ToBillSheet from "@/components/sales/ToBillSheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isReceiptDoc,
  thaiLongDate,
  type ToBillSheetData,
} from "@/lib/sales/to-bill-sheet";

function documentName(docno: string | null | undefined): string {
  if (isReceiptDoc(docno)) return "ใบเสร็จรับเงิน";
  if ((docno || "").trim().toUpperCase().startsWith("TO")) return "ใบกำกับภาษี";
  return "ใบเต็ม";
}

export default function ToBillDialog({
  docno,
  open,
  onOpenChange,
  onOpenTad,
}: {
  docno: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTad?: (billno: string) => void;
}) {
  const key = open && docno ? docno : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [bill, setBill] = useState<ToBillSheetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void fetch(`/api/to-bills/${encodeURIComponent(key)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดใบเต็มไม่สำเร็จ");
        if (!cancelled) {
          setBill(json as ToBillSheetData);
          setError(null);
          setLoadedKey(key);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBill(null);
          setError(err instanceof Error ? err.message : "โหลดใบเต็มไม่สำเร็จ");
          setLoadedKey(key);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const loading = key !== "" && loadedKey !== key;
  const voided = bill?.status === "void";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[90]"
        className="left-0 top-0 z-[90] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,980px)] sm:w-[min(920px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left print:hidden">
          <DialogTitle className="text-base sm:text-lg">
            {bill?.docno || docno || "ใบเต็ม"}
            {voided ? " (ยกเลิก)" : ""}
          </DialogTitle>
          <DialogDescription className="text-left">
            {bill
              ? [
                  documentName(bill.docno),
                  bill.customer_name,
                  bill.tax_id,
                  thaiLongDate(bill.bill_date),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : documentName(docno)}
          </DialogDescription>
          {bill ? (
            <button
              type="button"
              className="w-fit text-left text-sm text-sky-800 underline"
              onClick={() => onOpenTad?.(bill.tad_billno)}
            >
              อ้างอิง {bill.tad_billno}
            </button>
          ) : null}
          <DialogPrintButton
            disabled={loading || Boolean(error) || !bill}
            documentTitle={bill ? bill.docno : docno || "ใบเต็ม"}
            pageMargin="12mm"
          />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 print:overflow-visible print:p-0">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground print:hidden">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600 print:hidden">{error}</p>
          ) : !bill ? (
            <p className="py-6 text-sm text-muted-foreground print:hidden">ไม่พบใบเต็ม</p>
          ) : (
            <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))] print:pb-0">
              <ToBillSheet bill={bill} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
