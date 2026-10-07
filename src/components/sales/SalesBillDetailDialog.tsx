"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SalesBillTarget = {
  billno: string;
  docType?: string | null;
  source?: "sales" | "purchase";
};

type SalesBillLine = {
  bcode: string | null;
  detail: string | null;
  qty: number;
  ui: string | null;
  price: number;
  amount: number;
};

type SalesBill = {
  doc_type: string;
  billno: string;
  bill_date: string | null;
  acctname: string | null;
  po: string | null;
  beforetax: number;
  tax: number;
  aftertax: number;
  canceled: boolean;
  lines: SalesBillLine[];
};

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormat = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 4,
});

function formatMoney(value: number): string {
  return money.format(Number.isFinite(value) ? value : 0);
}

function formatQty(value: number): string {
  return qtyFormat.format(Number.isFinite(value) ? value : 0);
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

export function SalesBillNoButton({
  billno,
  docType,
  source = "sales",
  onOpen,
  className = "min-w-0 break-all text-left text-sm font-medium text-sky-800 underline",
}: {
  billno: string;
  docType?: string | null;
  source?: "sales" | "purchase";
  onOpen: (target: SalesBillTarget) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onOpen({ billno, docType, source });
      }}
    >
      {billno}
    </button>
  );
}

export default function SalesBillDetailDialog({
  target,
  open,
  onOpenChange,
}: {
  target: SalesBillTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const billno = target?.billno?.trim() ?? "";
  const docType = target?.docType?.trim() ?? "";
  const source = target?.source === "purchase" ? "purchase" : "sales";
  const requestKey = open && billno ? `${source}|${docType}|${billno}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [bill, setBill] = useState<SalesBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestKey || !billno) return;
    let cancelled = false;
    const params = new URLSearchParams({ billno });
    if (docType) params.set("doc_type", docType);
    const path = source === "purchase" ? "/api/sales-bills/purchase" : "/api/sales-bills/detail";
    void fetch(`${path}?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดรายละเอียดบิลไม่สำเร็จ");
        if (!cancelled) {
          setBill(json as SalesBill);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBill(null);
          setError(err instanceof Error ? err.message : "โหลดรายละเอียดบิลไม่สำเร็จ");
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, billno, docType, source]);

  const loading = requestKey !== "" && loadedKey !== requestKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[80]"
        className="left-0 top-0 z-[80] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(840px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {bill ? `${bill.doc_type} ${bill.billno}` : billno || "รายละเอียดบิล"}
            {bill?.canceled ? " (ยกเลิก)" : ""}
          </DialogTitle>
          <DialogDescription className="text-left">
            {bill
              ? [
                  formatWhen(bill.bill_date),
                  bill.acctname,
                  bill.po ? `PO ${bill.po}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "รายการในบิล"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600">{error}</p>
          ) : !bill ? (
            <p className="py-6 text-sm text-muted-foreground">ไม่พบบิล</p>
          ) : (
            <div className="flex flex-col gap-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border px-3 py-3 text-sm">
                {source === "sales" ? (
                  <>
                    <dt className="text-muted-foreground">ก่อนภาษี</dt>
                    <dd className="text-right tabular-nums">{formatMoney(bill.beforetax)}</dd>
                    <dt className="text-muted-foreground">ภาษี</dt>
                    <dd className="text-right tabular-nums">{formatMoney(bill.tax)}</dd>
                  </>
                ) : null}
                <dt className="font-medium">รวม</dt>
                <dd className="text-right font-medium tabular-nums">
                  {formatMoney(bill.aftertax)}
                </dd>
              </dl>
              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">BCODE</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">รายละเอียด</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">จำนวน</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">ราคา</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={5}>
                          ไม่มีรายการ
                        </td>
                      </tr>
                    ) : (
                      bill.lines.map((line, index) => (
                        <tr key={`${line.bcode ?? "line"}-${index}`} className="border-b">
                          <td className="p-2 font-mono">{line.bcode ?? "—"}</td>
                          <td className="p-2">{line.detail ?? "—"}</td>
                          <td className="whitespace-nowrap p-2 tabular-nums">
                            {formatQty(line.qty)}
                            {line.ui ? ` ${line.ui}` : ""}
                          </td>
                          <td className="p-2 tabular-nums">{formatMoney(line.price)}</td>
                          <td className="p-2 tabular-nums">{formatMoney(line.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
