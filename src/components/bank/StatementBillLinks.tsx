"use client";

import { useEffect, useState } from "react";

import type { StatementLineRow } from "@/components/bank/types";
import DialogPrintButton from "@/components/common/DialogPrintButton";
import {
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
  statementExpenseReceipts,
  statementPurchaseBills,
  statementSalesBills,
  statementVoucherNo,
  voucherListSummary,
} from "@/lib/bank/statement-doc-links";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type VoucherBill = {
  source: "sales" | "purchase" | "discount";
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
  onOpenExpense,
}: {
  row: StatementLineRow;
  linkClassName?: string;
  onOpenSales: (target: SalesBillTarget) => void;
  onOpenList: (list: { title: string; bills: SalesBillTarget[] }) => void;
  onOpenVoucher: (voucherNo: string) => void;
  onOpenExpense: (receiptIds: string[]) => void;
}) {
  const sales = statementSalesBills(row);
  const voucherNo = statementVoucherNo(row);
  const purchase = statementPurchaseBills(row);
  const expense = statementExpenseReceipts(row);

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
      {expense?.length ? (
        <button
          type="button"
          className={linkClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenExpense(expense);
          }}
        >
          {expense.length === 1
            ? "ดูใบสำคัญจ่าย"
            : `ดูใบสำคัญจ่าย ${expense.length} ใบ`}
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
          <DialogPrintButton disabled={bills.length === 0} documentTitle={title} />
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
  const summary = voucherListSummary(bills);
  const discountText =
    summary.discount < 0
      ? ` · ส่วนลด ${money.format(Math.abs(summary.discount))}`
      : summary.discount > 0
        ? ` · ส่วนลด ${money.format(summary.discount)}`
        : "";

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
            {loading
              ? "กำลังโหลด"
              : `${summary.billCount} บิล${discountText} · ${money.format(summary.total)} บาท`}
          </DialogDescription>
          <DialogPrintButton
            disabled={loading || Boolean(error) || bills.length === 0}
            documentTitle={voucherNo ? `ใบสำคัญ ${voucherNo}` : "ใบสำคัญ"}
          />
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
              {bills.map((bill) =>
                bill.source === "discount" ? (
                  <li
                    key="discount"
                    className="flex items-start justify-between gap-3 rounded-lg border border-dashed px-3 py-3"
                  >
                    <div className="min-w-0 text-sm font-medium">ส่วนลด</div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {money.format(bill.amount)}
                    </div>
                  </li>
                ) : (
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
                )
              )}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ExpenseReceiptLine = {
  item_name: string | null;
  detail: string | null;
  qty: number;
  price: number;
  amount: number;
};

type ExpenseReceiptDetail = {
  receipt_uuid: string;
  receipt_number: string;
  receipt_date: string | null;
  party_name: string | null;
  payment_description: string | null;
  voucher_description: string | null;
  vat_rate: number;
  withholding_rate: number;
  beforeTax: number;
  discount: number;
  vatAmount: number;
  withholdingAmount: number;
  net: number;
  lines: ExpenseReceiptLine[];
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

function expenseReceiptMeta(receipt: ExpenseReceiptDetail): string {
  return [
    formatWhen(receipt.receipt_date),
    receipt.party_name,
    receipt.payment_description,
    receipt.voucher_description,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ExpenseVoucherDialog({
  receiptIds,
  open,
  onOpenChange,
}: {
  receiptIds: string[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ids = receiptIds ?? [];
  const requestKey = open && ids.length > 0 ? ids.join(",") : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [receipts, setReceipts] = useState<ExpenseReceiptDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setBillId(null);
  }, [open]);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const params = new URLSearchParams({ ids: requestKey });
    void fetch(`/api/bank/statement-lines/expense-receipt?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดใบสำคัญไม่สำเร็จ");
        if (!cancelled) {
          setReceipts(json.receipts ?? []);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReceipts([]);
          setError(err instanceof Error ? err.message : "โหลดใบสำคัญไม่สำเร็จ");
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = requestKey !== "" && loadedKey !== requestKey;
  const bill = receipts.find((receipt) => receipt.receipt_uuid === billId) ?? null;
  const title =
    receipts.length === 1
      ? `ใบสำคัญจ่าย ${receipts[0].receipt_number}`
      : receipts.length > 1
        ? `ใบสำคัญจ่าย ${receipts.length} ใบ`
        : "ใบสำคัญจ่าย";
  const summary =
    receipts.length === 1
      ? [formatWhen(receipts[0].receipt_date), receipts[0].party_name, receipts[0].payment_description]
          .filter(Boolean)
          .join(" · ")
      : receipts.length > 1
        ? receipts.map((receipt) => receipt.receipt_number).join(", ")
        : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          overlayClassName="z-[80]"
          className="left-0 top-0 z-[80] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(640px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
          onInteractOutside={(event) => {
            if (billId) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (billId) event.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
            <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
            <DialogDescription className="text-left">
              {loading
                ? "กำลังโหลด"
                : [summary, receipts.length > 0 ? "กดเลขที่เอกสารเพื่อดูบิล" : "รายการในใบสำคัญจ่าย"]
                    .filter(Boolean)
                    .join(" · ")}
            </DialogDescription>
            <DialogPrintButton
              disabled={loading || Boolean(error) || receipts.length === 0}
              documentTitle={title}
            />
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
            {loading ? (
              <p className="py-6 text-sm text-muted-foreground">กำลังโหลด</p>
            ) : error ? (
              <p className="py-6 text-sm text-red-600">{error}</p>
            ) : receipts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">ไม่พบใบสำคัญจ่าย</p>
            ) : (
              <ul className="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {receipts.map((receipt) => (
                  <li
                    key={receipt.receipt_uuid}
                    className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="min-w-0 break-all text-left text-sm font-medium text-sky-800 underline"
                        onClick={() => setBillId(receipt.receipt_uuid)}
                      >
                        {receipt.receipt_number || "ไม่มีเลขที่เอกสาร"}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {["เลขที่เอกสาร", expenseReceiptMeta(receipt)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {money.format(receipt.net)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ExpenseBillDialog
        receipt={bill}
        open={billId !== null}
        onOpenChange={(next) => {
          if (!next) setBillId(null);
        }}
      />
    </>
  );
}

function ExpenseBillDialog({
  receipt,
  open,
  onOpenChange,
}: {
  receipt: ExpenseReceiptDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const title = receipt?.receipt_number ? `บิล ${receipt.receipt_number}` : "บิล";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[90]"
        className="left-0 top-0 z-[90] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(840px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription className="text-left">
            {receipt ? expenseReceiptMeta(receipt) || "รายการในบิล" : "รายการในบิล"}
          </DialogDescription>
          <DialogPrintButton disabled={!receipt} documentTitle={title} />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {!receipt ? (
            <p className="py-6 text-sm text-muted-foreground">ไม่พบบิล</p>
          ) : (
            <div className="flex flex-col gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="overflow-auto rounded-md border print:overflow-visible print:border-0">
                <table className="w-full min-w-[36rem] border-collapse text-sm print:min-w-0">
                  <thead>
                    <tr className="text-left">
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">รายการ</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">รายละเอียด</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">จำนวน</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">ราคา</th>
                      <th className="sticky top-0 z-10 border-b bg-muted p-2">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.lines.length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={5}>
                          ไม่มีรายการ
                        </td>
                      </tr>
                    ) : (
                      receipt.lines.map((line, index) => (
                        <tr key={`${receipt.receipt_uuid}-${index}`} className="border-b">
                          <td className="p-2">{line.item_name ?? "—"}</td>
                          <td className="p-2">{line.detail ?? "—"}</td>
                          <td className="whitespace-nowrap p-2 tabular-nums">{line.qty}</td>
                          <td className="p-2 tabular-nums">{money.format(line.price)}</td>
                          <td className="p-2 tabular-nums">{money.format(line.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border px-3 py-3 text-sm">
                <dt className="text-muted-foreground">ราคาก่อนภาษี</dt>
                <dd className="text-right tabular-nums">{money.format(receipt.beforeTax)}</dd>
                <dt className="text-muted-foreground">ส่วนลด</dt>
                <dd className="text-right tabular-nums">{money.format(receipt.discount)}</dd>
                <dt className="text-muted-foreground">ภาษี {receipt.vat_rate}%</dt>
                <dd className="text-right tabular-nums">{money.format(receipt.vatAmount)}</dd>
                <dt className="text-muted-foreground">หัก ณ ที่จ่าย {receipt.withholding_rate}%</dt>
                <dd className="text-right tabular-nums">
                  {money.format(receipt.withholdingAmount)}
                </dd>
                <dt className="font-medium">ราคารวมสุทธิ</dt>
                <dd className="text-right font-medium tabular-nums">{money.format(receipt.net)}</dd>
              </dl>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
