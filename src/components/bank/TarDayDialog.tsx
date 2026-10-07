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
import type { StatementLineRow } from "@/components/bank/types";
import SalesBillDetailDialog, {
  SalesBillNoButton,
  type SalesBillTarget,
} from "@/components/sales/SalesBillDetailDialog";
import {
  summarizeTarDayBills,
  tarDayLookup,
  type TarDayBill,
} from "@/lib/bank/tar-day";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number): string {
  return money.format(Number.isFinite(value) ? value : 0);
}

function formatWhen(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

export function TarDayLink({
  row,
  onOpen,
  className = "mt-1 inline-block text-left text-xs font-medium text-sky-800 underline",
}: {
  row: StatementLineRow;
  onOpen: (row: StatementLineRow) => void;
  className?: string;
}) {
  const lookup = tarDayLookup(row);
  if (!lookup) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(row);
      }}
    >
      {lookup.label}
    </button>
  );
}

export default function TarDayDialog({
  row,
  open,
  onOpenChange,
}: {
  row: StatementLineRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lookup = row ? tarDayLookup(row) : null;
  const billDate = lookup?.date ?? null;
  const series = lookup?.series ?? null;
  const requestKey = open && billDate && series ? `${billDate}|${series}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [bills, setBills] = useState<TarDayBill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [billTarget, setBillTarget] = useState<SalesBillTarget | null>(null);

  useEffect(() => {
    if (!requestKey || !billDate || !series) return;
    let cancelled = false;
    const params = new URLSearchParams({ date: billDate, series });
    void fetch(`/api/bank/statement-lines/tar-day?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดรายการไม่สำเร็จ");
        if (!cancelled) {
          setBills(json.bills ?? []);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBills([]);
          setError(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ");
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, billDate, series]);

  useEffect(() => {
    if (!open) setBillTarget(null);
  }, [open]);

  const loading = requestKey !== "" && loadedKey !== requestKey;

  const totals = summarizeTarDayBills(bills);
  const bankAmount = Number(row?.amount ?? 0);
  const delta = bankAmount - totals.net;
  const salesKind = lookup?.series === "syp" ? "3TAR" : "TAR";
  const creditKind = lookup?.series === "syp" ? "3CNTAR" : "CNTAR";
  const salesBills = bills.filter((bill) => bill.doc_type === salesKind);
  const creditBills = bills.filter((bill) => bill.doc_type === creditKind);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-0 top-0 z-[60] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(640px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
        onInteractOutside={(event) => {
          if (billTarget) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (billTarget) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {lookup ? lookup.label.replace(/^ดูบิล /, "") : "บิล TAR"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {lookup
              ? `ยอดขายวันที่ ${formatWhen(lookup.date)} · เงินเข้าบัญชี ${formatWhen(row?.txn_date ?? lookup.date)} ${formatMoney(bankAmount)} บาท`
              : "ยอดที่โอนเข้าบัญชี"}
          </DialogDescription>
          <DialogPrintButton
            disabled={loading || Boolean(error) || bills.length === 0}
            documentTitle={lookup ? lookup.label.replace(/^ดูบิล /, "") : "บิล TAR"}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600">{error}</p>
          ) : bills.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">ไม่พบบิลของวันนี้</p>
          ) : (
            <div className="flex flex-col gap-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border px-3 py-3 text-sm">
                <dt className="text-muted-foreground">ยอด{salesKind}</dt>
                <dd className="text-right tabular-nums">{formatMoney(totals.tar_total)}</dd>
                <dt className="text-muted-foreground">ยอด{creditKind}</dt>
                <dd className="text-right tabular-nums">{formatMoney(totals.cntar_total)}</dd>
                <dt className="font-medium">ยอดสุทธิ</dt>
                <dd className="text-right font-medium tabular-nums">{formatMoney(totals.net)}</dd>
                {Math.abs(delta) >= 0.01 ? (
                  <>
                    <dt className="text-muted-foreground">ส่วนต่างจากยอดเข้าบัญชี</dt>
                    <dd className="text-right tabular-nums">{formatMoney(delta)}</dd>
                  </>
                ) : null}
              </dl>
              <BillList title={salesKind} bills={salesBills} onOpen={setBillTarget} />
              <BillList title={creditKind} bills={creditBills} onOpen={setBillTarget} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <SalesBillDetailDialog
      target={billTarget}
      open={billTarget !== null}
      onOpenChange={(next) => {
        if (!next) setBillTarget(null);
      }}
    />
    </>
  );
}

function BillList({
  title,
  bills,
  onOpen,
}: {
  title: string;
  bills: TarDayBill[];
  onOpen: (target: SalesBillTarget) => void;
}) {
  if (bills.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ul className="flex flex-col gap-2">
        {bills.map((bill) => (
          <li
            key={`${bill.doc_type}:${bill.billno}`}
            className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
          >
            <SalesBillNoButton billno={bill.billno} docType={bill.doc_type} onOpen={onOpen} />
            <div className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(bill.amount)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
