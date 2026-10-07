"use client";

import { useEffect, useMemo, useState } from "react";

import DialogPrintButton from "@/components/common/DialogPrintButton";
import SalesBillDetailDialog, {
  SalesBillNoButton,
  type SalesBillTarget,
} from "@/components/sales/SalesBillDetailDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Payout = {
  payout_key: string;
  platform: string;
  shop: string;
  payout_at: string | null;
  amount: number | string;
  reference: string | null;
  order_count: number;
  expense_amount: number | string;
  component_net: number | string;
  matched_order_count: number;
  source_file: string | null;
  note: string | null;
};

type Deposit = {
  platform: string;
  shop: string;
  bank_date: string;
  amount: number | string;
  period_from: string;
  period_to: string;
  payout_count: number;
};

type Fee = { name: string; amount: string };

type Line = {
  line_no: number;
  order_id: string | null;
  fee_name: string | null;
  detail: string | null;
  gross_amount: number | string | null;
  expense_amount: number | string | null;
  net_amount: number | string;
  fees: Fee[] | null;
};

type Bill = {
  order_id: string;
  billno: string;
  po: string | null;
  match_method: string | null;
  aftertax: number | string | null;
  acctname: string | null;
  canceled: boolean;
};

type Receipt = {
  order_id: string;
  receipt_no: string | null;
  receipt_status: string | null;
  receipt_amount: number | string | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  lazada: "Lazada",
  shopee: "Shopee",
  tiktok: "TikTok",
};

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return money.format(Number.isFinite(parsed) ? parsed : 0);
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value.slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

function feeText(fees: Fee[] | null): string {
  return (fees ?? [])
    .filter((fee) => Number(fee.amount) < 0)
    .map((fee) => `${fee.name} ${formatMoney(fee.amount)}`)
    .join(", ");
}

export default function OnlineDepositDialog({
  lineId,
  open,
  onOpenChange,
}: {
  lineId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [billTarget, setBillTarget] = useState<SalesBillTarget | null>(null);

  useEffect(() => {
    if (!open || !lineId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedKey(null);
    setDeposit(null);
    setPayouts([]);
    void fetch(`/api/online-statements?deposit=${encodeURIComponent(lineId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดรายการไม่สำเร็จ");
        if (!cancelled) {
          setDeposit(json.deposit ?? null);
          setPayouts(json.payouts ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, lineId]);

  useEffect(() => {
    if (!selectedKey) {
      setLines([]);
      setBills([]);
      setReceipts([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setOnlyUnmatched(false);
    const params = new URLSearchParams({ payout: selectedKey });
    void fetch(`/api/online-statements/detail?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดรายละเอียดไม่สำเร็จ");
        if (!cancelled) {
          setLines(json.lines ?? []);
          setBills(json.bills ?? []);
          setReceipts(json.receipts ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดรายละเอียดไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  useEffect(() => {
    if (!open || !selectedKey) setBillTarget(null);
  }, [open, selectedKey]);

  const selected = payouts.find((row) => row.payout_key === selectedKey) ?? null;
  const billsByOrder = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const bill of bills) {
      const list = map.get(bill.order_id) ?? [];
      list.push(bill);
      map.set(bill.order_id, list);
    }
    return map;
  }, [bills]);
  const receiptsByOrder = useMemo(() => {
    const map = new Map<string, Receipt>();
    for (const receipt of receipts) map.set(receipt.order_id, receipt);
    return map;
  }, [receipts]);
  const visibleLines = onlyUnmatched
    ? lines.filter((line) => !line.order_id || (billsByOrder.get(line.order_id) ?? []).length === 0)
    : lines;
  const unmatchedCount = lines.filter(
    (line) => line.order_id && line.order_id !== "0" && (billsByOrder.get(line.order_id) ?? []).length === 0
  ).length;

  const title = deposit
    ? `${platformLabel(deposit.platform)} ${deposit.shop} · ${formatMoney(deposit.amount)} บาท`
    : "เงินเข้าออนไลน์";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-0 top-0 z-[60] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(960px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
        onInteractOutside={(event) => {
          if (billTarget) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (billTarget) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {selected
              ? `${platformLabel(selected.platform)} ${selected.shop} · ${formatMoney(selected.amount)} บาท`
              : title}
          </DialogTitle>
          <DialogDescription className="text-left">
            {selected
              ? selected.reference
              : deposit
                ? `รายการธนาคาร ${formatWhen(deposit.bank_date)} · สเตทเมนต์ ${formatWhen(deposit.period_from)} – ${formatWhen(deposit.period_to)}`
                : "ยอดที่โอนเข้าบัญชี"}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            <DialogPrintButton
              disabled={
                loading ||
                Boolean(error) ||
                (selectedKey ? detailLoading || visibleLines.length === 0 : payouts.length === 0)
              }
              documentTitle={
                selected
                  ? `${platformLabel(selected.platform)} ${selected.shop}`
                  : title
              }
            />
            {selected ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="print:hidden"
                onClick={() => setSelectedKey(null)}
              >
                กลับไปรายการวัน
              </Button>
            ) : null}
          </div>
          {selected && onlyUnmatched ? (
            <p className="hidden text-xs text-muted-foreground print:block">
              แสดงเฉพาะรายการที่ยังไม่พบ PO
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600">{error}</p>
          ) : selectedKey ? (
            detailLoading ? (
              <p className="py-6 text-sm text-muted-foreground">กำลังโหลดรายละเอียด</p>
            ) : (
              <ul className="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <li className="flex gap-2 print:hidden">
                  <Button
                    type="button"
                    size="sm"
                    variant={onlyUnmatched ? "outline" : "default"}
                    onClick={() => setOnlyUnmatched(false)}
                  >
                    ทั้งหมด
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={onlyUnmatched ? "default" : "outline"}
                    onClick={() => setOnlyUnmatched(true)}
                  >
                    ยังไม่พบ PO ({unmatchedCount})
                  </Button>
                </li>
                {visibleLines.map((line) => {
                  const linked = line.order_id ? billsByOrder.get(line.order_id) ?? [] : [];
                  const receipt = line.order_id ? receiptsByOrder.get(line.order_id) : undefined;
                  const fees = feeText(line.fees);
                  return (
                    <li key={line.line_no} className="rounded-lg border px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 break-all text-sm font-medium">
                          {line.order_id || line.fee_name || "รายการปรับ"}
                        </div>
                        <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                          {formatMoney(line.net_amount)}
                        </div>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">ก่อนหัก</dt>
                        <dd className="text-right tabular-nums">{formatMoney(line.gross_amount)}</dd>
                        <dt className="text-muted-foreground">ค่าใช้จ่าย</dt>
                        <dd className="text-right tabular-nums">{formatMoney(line.expense_amount)}</dd>
                      </dl>
                      {fees ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{fees}</p> : null}
                      {receipt ? (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">
                            {receipt.receipt_no
                              ? `Peak ${receipt.receipt_no}`
                              : `Peak ${receipt.receipt_status || "ยังไม่สร้างเอกสาร"}`}
                          </span>
                        </p>
                      ) : null}
                      <div className="mt-2 text-sm">
                        {linked.length === 0 ? (
                          <span className="text-amber-700">ยังไม่พบ PO</span>
                        ) : (
                          linked.map((bill) => (
                            <div key={bill.billno} className="mt-1">
                              <SalesBillNoButton billno={bill.billno} docType="TAD" onOpen={setBillTarget} />
                              {bill.canceled ? " (ยกเลิก)" : ""}
                              <div className="text-xs text-muted-foreground">
                                PO {bill.po} · {formatMoney(bill.aftertax)}
                                {bill.acctname ? ` · ${bill.acctname}` : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <ul className="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {payouts.map((row) => (
                <li key={row.payout_key}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left hover:bg-slate-50"
                    onClick={() => setSelectedKey(row.payout_key)}
                  >
                    <div>
                      <div className="text-sm font-medium">{formatWhen(row.payout_at)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        ออเดอร์ {row.order_count} · TAD {row.matched_order_count}/{row.order_count}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(row.amount)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
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
