"use client";

import { useEffect, useState } from "react";

import DialogPrintButton from "@/components/common/DialogPrintButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ToBillLine = {
  bcode: string | null;
  detail: string | null;
  qty: number;
  ui: string | null;
  price: number;
  amount: number;
};

type ToBill = {
  docno: string;
  status: string;
  tad_billno: string;
  bill_date: string | null;
  customer_name: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
  branch_label: string | null;
  email: string | null;
  online_po: string | null;
  beforetax: number;
  tax: number;
  aftertax: number;
  discount: number;
  void_reason: string | null;
  lines: ToBillLine[];
};

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 4 });

function formatMoney(value: number): string {
  return money.format(Number.isFinite(value) ? value : 0);
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
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
  const [bill, setBill] = useState<ToBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void fetch(`/api/to-bills/${encodeURIComponent(key)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดใบเต็มไม่สำเร็จ");
        if (!cancelled) {
          setBill(json as ToBill);
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
        className="left-0 top-0 z-[90] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(840px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {bill?.docno || docno || "ใบเต็ม"}
            {voided ? " (ยกเลิก)" : ""}
          </DialogTitle>
          <DialogDescription className="text-left">
            {bill
              ? [
                  bill.customer_name,
                  bill.tax_id,
                  formatWhen(bill.bill_date),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "ใบกำกับภาษีเต็มรูป"}
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
          />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600">{error}</p>
          ) : !bill ? (
            <p className="py-6 text-sm text-muted-foreground">ไม่พบใบเต็ม</p>
          ) : (
            <div className="flex flex-col gap-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {voided ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  ยกเลิกแล้ว{bill.void_reason ? ` · ${bill.void_reason}` : ""}
                </p>
              ) : null}
              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 rounded-lg border px-3 py-3 text-sm">
                <dt className="text-muted-foreground">ผู้ซื้อ</dt>
                <dd>{bill.customer_name || "—"}</dd>
                <dt className="text-muted-foreground">ที่อยู่</dt>
                <dd className="whitespace-pre-wrap">{bill.address || "—"}</dd>
                <dt className="text-muted-foreground">สาขา</dt>
                <dd>{bill.branch_label || "—"}</dd>
                <dt className="text-muted-foreground">โทร</dt>
                <dd>{bill.phone || "—"}</dd>
                {bill.email ? (
                  <>
                    <dt className="text-muted-foreground">อีเมล</dt>
                    <dd>{bill.email}</dd>
                  </>
                ) : null}
                {bill.online_po ? (
                  <>
                    <dt className="text-muted-foreground">ออเดอร์</dt>
                    <dd>{bill.online_po}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">ก่อนภาษี</dt>
                <dd className="text-right tabular-nums">{formatMoney(bill.beforetax)}</dd>
                {bill.discount ? (
                  <>
                    <dt className="text-muted-foreground">ส่วนลด</dt>
                    <dd className="text-right tabular-nums">{formatMoney(bill.discount)}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">ภาษี</dt>
                <dd className="text-right tabular-nums">{formatMoney(bill.tax)}</dd>
                <dt className="font-medium">รวม</dt>
                <dd className="text-right font-medium tabular-nums">{formatMoney(bill.aftertax)}</dd>
              </dl>
              <div className="overflow-auto rounded-md border print:overflow-visible print:border-0">
                <table className="w-full min-w-[36rem] border-collapse text-sm print:min-w-0">
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
                            {qtyFormat.format(line.qty)}
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
