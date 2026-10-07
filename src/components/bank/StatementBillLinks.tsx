"use client";

import { useEffect, useState } from "react";

import type { StatementLineRow } from "@/components/bank/types";
import SalesBillDetailDialog, {
  SalesBillNoButton,
  type SalesBillTarget,
} from "@/components/sales/SalesBillDetailDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  statementPurchaseBills,
  statementSalesBills,
  statementVoucherNo,
} from "@/lib/bank/statement-doc-links";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type VoucherBill = {
  source: "sales" | "purchase";
  doc_type: string;
  billno: string;
  bill_date: string | null;
  acctname: string | null;
  amount: number;
  canceled: boolean;
};

const linkClass =
  "mt-1 block text-left text-xs font-medium text-sky-800 underline";

export function StatementBillLinks({
  row,
  linkClassName = linkClass,
  onOpenSales,
  onOpenList,
  onOpenVoucher,
}: {
  row: StatementLineRow;
  linkClassName?: string;
  onOpenSales: (target: SalesBillTarget) => void;
  onOpenList: (list: { title: string; bills: SalesBillTarget[] }) => void;
  onOpenVoucher: (voucherNo: string) => void;
}) {
  const sales = statementSalesBills(row);
  const voucherNo = statementVoucherNo(row);
  const purchase = statementPurchaseBills(row);

  return (
    <>
      {sales?.length === 1 ? (
        <button
          type="button"
          className={linkClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenSales({ billno: sales[0].billno, docType: sales[0].docType });
          }}
        >
          ดูบิล {sales[0].billno}
        </button>
      ) : null}
      {sales && sales.length > 1 ? (
        <button
          type="button"
          className={linkClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenList({
              title: `บิล TR ${sales.length} ใบ`,
              bills: sales.map((bill) => ({ billno: bill.billno, docType: bill.docType })),
            });
          }}
        >
          ดูบิล TR {sales.length} ใบ
        </button>
      ) : null}
      {voucherNo ? (
        <button
          type="button"
          className={linkClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenVoucher(voucherNo);
          }}
        >
          ดูบิลในใบสำคัญ {voucherNo}
        </button>
      ) : null}
      {purchase?.length === 1 ? (
        <button
          type="button"
          className={linkClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenSales({ billno: purchase[0], source: "purchase" });
          }}
        >
          ดูบิล {purchase[0]}
        </button>
      ) : null}
      {purchase && purchase.length > 1 ? (
        <button
          type="button"
          className={linkClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenList({
              title: `บิลซื้อ ${purchase.length} ใบ`,
              bills: purchase.map((billno) => ({ billno, source: "purchase" as const })),
            });
          }}
        >
          ดูบิลซื้อ {purchase.length} ใบ
        </button>
      ) : null}
    </>
  );
}

export function StatementBillListDialog({
  title,
  bills,
  open,
  detailOpen,
  onOpenChange,
  onOpenBill,
}: {
  title: string;
  bills: SalesBillTarget[];
  open: boolean;
  detailOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenBill: (target: SalesBillTarget) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[70]"
        className="left-0 top-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(640px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
        onInteractOutside={(event) => {
          if (detailOpen) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (detailOpen) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription className="text-left">กดเลขที่บิลเพื่อดูรายการ</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          <ul className="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {bills.map((bill) => (
              <li key={`${bill.source ?? "sales"}:${bill.billno}`} className="rounded-lg border px-3 py-3">
                <SalesBillNoButton
                  billno={bill.billno}
                  docType={bill.docType}
                  source={bill.source}
                  onOpen={onOpenBill}
                />
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VoucherBillsDialog({
  voucherNo,
  open,
  detailOpen,
  onOpenChange,
  onOpenBill,
}: {
  voucherNo: string | null;
  open: boolean;
  detailOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenBill: (target: SalesBillTarget) => void;
}) {
  const requestKey = open && voucherNo ? voucherNo : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [bills, setBills] = useState<VoucherBill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const params = new URLSearchParams({ voucher: requestKey });
    void fetch(`/api/sales-bills/voucher?${params.toString()}`)
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
  }, [requestKey]);

  const loading = requestKey !== "" && loadedKey !== requestKey;
  const total = bills.reduce((sum, bill) => sum + (bill.canceled ? 0 : bill.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[70]"
        className="left-0 top-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(640px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
        onInteractOutside={(event) => {
          if (detailOpen) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (detailOpen) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">ใบสำคัญ {voucherNo}</DialogTitle>
          <DialogDescription className="text-left">
            {loading ? "กำลังโหลด" : `${bills.length} บิล · ${money.format(total)} บาท`}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600">{error}</p>
          ) : bills.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">ไม่พบบิลในใบสำคัญนี้</p>
          ) : (
            <ul className="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {bills.map((bill) => (
                <li
                  key={`${bill.source}:${bill.billno}`}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
                >
                  <div className="min-w-0">
                    <SalesBillNoButton
                      billno={bill.billno}
                      docType={bill.doc_type}
                      source={bill.source}
                      onOpen={onOpenBill}
                    />
                    {bill.canceled ? <span className="text-sm"> (ยกเลิก)</span> : null}
                    <div className="text-xs text-muted-foreground">
                      {bill.doc_type}
                      {bill.acctname ? ` · ${bill.acctname}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold tabular-nums">
                    {money.format(bill.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
