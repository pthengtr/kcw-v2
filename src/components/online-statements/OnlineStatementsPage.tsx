"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import OnlineStatementUploadDialog from "@/components/online-statements/OnlineStatementUploadDialog";
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
  status: string;
  source_file: string | null;
  note: string | null;
  order_count: number;
  expense_amount: number | string;
  component_net: number | string;
  matched_order_count: number;
  built_at: string | null;
};

type Fee = { name: string; amount: string };

type Line = {
  line_no: number;
  line_kind: string;
  order_id: string | null;
  fee_name: string | null;
  detail: string | null;
  gross_amount: number | string | null;
  expense_amount: number | string | null;
  net_amount: number | string;
  fees: Fee[] | null;
  txn_at: string | null;
};

type Bill = {
  order_id: string;
  billno: string;
  po: string | null;
  match_method: string | null;
  bill_date: string | null;
  aftertax: number | string | null;
  acctname: string | null;
  canceled: boolean;
};

type Receipt = {
  order_id: string;
  receipt_no: string | null;
  receipt_date: string | null;
  receipt_status: string | null;
  receipt_amount: number | string | null;
  shop_name: string | null;
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

type Job = {
  id: number;
  status: string;
  worker_name: string | null;
  error_message: string | null;
  result_message: string | null;
};

const PLATFORMS = [
  { id: "all", label: "ทุกแพลตฟอร์ม" },
  { id: "lazada", label: "Lazada" },
  { id: "shopee", label: "Shopee" },
  { id: "tiktok", label: "TikTok" },
];

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number | string | null | undefined): string {
  return money.format(num(value));
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle:
      value.includes("T") && !value.endsWith("T00:00:00+07:00") ? "short" : undefined,
  }).format(date);
}

function platformLabel(platform: string): string {
  return PLATFORMS.find((item) => item.id === platform)?.label ?? platform;
}

function feeText(fees: Fee[] | null): string {
  return (fees ?? [])
    .filter((fee) => num(fee.amount) < 0)
    .map((fee) => `${fee.name} ${formatMoney(fee.amount)}`)
    .join(", ");
}

export default function OnlineStatementsPage({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const searchParams = useSearchParams();
  const depositId = searchParams.get("deposit") ?? "";
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("transferred");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [billTarget, setBillTarget] = useState<SalesBillTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(
      depositId ? { deposit: depositId } : { platform, status }
    );
    const res = await fetch(`/api/online-statements?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "โหลดรายการไม่สำเร็จ");
      setPayouts([]);
      setDeposit(null);
    } else {
      setPayouts(json.payouts ?? []);
      setDeposit(json.deposit ?? null);
    }
    setLoading(false);
  }, [platform, status, depositId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดรายละเอียดไม่สำเร็จ");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedKey) setBillTarget(null);
  }, [selectedKey]);

  useEffect(() => {
    if (!syncing) return;
    const timer = setInterval(async () => {
      const res = await fetch("/api/online-statements/sync");
      const json = await res.json();
      const next = json.job as Job | null;
      setJob(next);
      if (!next || next.status === "done" || next.status === "failed") {
        setSyncing(false);
        if (next?.status === "done") void load();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [syncing, load]);

  const selected = payouts.find((row) => row.payout_key === selectedKey) ?? null;
  const receiptsByOrder = useMemo(() => {
    const map = new Map<string, Receipt>();
    for (const receipt of receipts) map.set(receipt.order_id, receipt);
    return map;
  }, [receipts]);

  const billsByOrder = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const bill of bills) {
      const list = map.get(bill.order_id) ?? [];
      list.push(bill);
      map.set(bill.order_id, list);
    }
    return map;
  }, [bills]);

  const unmatchedCount = useMemo(() => {
    return lines.filter((line) => {
      if (!line.order_id) return false;
      return (billsByOrder.get(line.order_id) ?? []).length === 0;
    }).length;
  }, [lines, billsByOrder]);

  const visibleLines = useMemo(() => {
    if (!onlyUnmatched) return lines;
    return lines.filter((line) => {
      if (!line.order_id) return false;
      return (billsByOrder.get(line.order_id) ?? []).length === 0;
    });
  }, [lines, billsByOrder, onlyUnmatched]);

  const totals = useMemo(() => {
    return payouts.reduce(
      (acc, row) => {
        acc.amount += num(row.amount);
        acc.expense += num(row.expense_amount);
        acc.orders += row.order_count;
        acc.matched += row.matched_order_count;
        return acc;
      },
      { amount: 0, expense: 0, orders: 0, matched: 0 }
    );
  }, [payouts]);

  async function rebuild() {
    setError(null);
    setSyncing(true);
    const res = await fetch("/api/online-statements/sync", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setSyncing(false);
      setError(json.error ?? "สั่งงานไม่สำเร็จ");
      return;
    }
    setJob(json.job ?? null);
    if (json.job && (json.job.status === "done" || json.job.status === "failed")) {
      setSyncing(false);
    }
  }

  function openPayout(key: string) {
    setSelectedKey(key);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">เงินเข้าออนไลน์</h1>
          <p className="text-sm text-muted-foreground">
            ยอดที่โอนเข้าบัญชี แยกตามแพลตฟอร์ม แล้วไล่ไปออเดอร์ ค่าธรรมเนียม และบิล TAD
          </p>
        </div>
        {readOnly ? null : (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setUploadOpen(true)}
            >
              อัปโหลดไฟล์
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void rebuild()}
              disabled={syncing}
            >
              {syncing ? "กำลังจับคู่..." : "สั่ง worker จับคู่ใหม่"}
            </Button>
          </div>
        )}
      </div>
      {readOnly ? null : (
        <OnlineStatementUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploaded={() => setSyncing(true)}
        />
      )}

      {job ? (
        <p className="text-sm text-muted-foreground">
          งาน #{job.id} {job.status}
          {job.worker_name ? ` · ${job.worker_name}` : ""}
          {job.error_message ? ` · ${job.error_message}` : ""}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {deposit ? (
        <div className="rounded-lg border px-3 py-3 text-sm">
          <div className="font-medium">
            รายการธนาคาร {formatWhen(deposit.bank_date)} · {platformLabel(deposit.platform)}{" "}
            {deposit.shop} · {formatMoney(deposit.amount)} บาท
          </div>
          <p className="mt-1 text-muted-foreground">
            รวมสเตทเมนต์ {formatWhen(deposit.period_from)} – {formatWhen(deposit.period_to)} (
            {deposit.payout_count} วัน)
          </p>
          <a href="/online-statements" className="mt-2 inline-block text-xs underline">
            ดูยอดทั้งหมด
          </a>
        </div>
      ) : null}

      {deposit ? null : (
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {PLATFORMS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            className="shrink-0"
            variant={platform === item.id ? "default" : "outline"}
            onClick={() => {
              setPlatform(item.id);
              setSelectedKey(null);
            }}
          >
            {item.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={status === "transferred" ? "default" : "outline"}
          onClick={() => {
            setStatus("transferred");
            setSelectedKey(null);
          }}
        >
          โอนเข้าบัญชีแล้ว
        </Button>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={status === "pending" ? "default" : "outline"}
          onClick={() => {
            setStatus("pending");
            setSelectedKey(null);
          }}
        >
          ยังไม่โอน
        </Button>
      </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Summary label="ยอดเงิน" value={formatMoney(totals.amount)} />
        <Summary label="ค่าใช้จ่าย" value={formatMoney(totals.expense)} />
        <Summary label="ออเดอร์" value={String(totals.orders)} />
        <Summary label="จับคู่ TAD" value={String(totals.matched)} />
      </div>

      {loading ? (
        <p className="px-1 py-6 text-sm text-muted-foreground">กำลังโหลด</p>
      ) : payouts.length === 0 ? (
        <p className="px-1 py-6 text-sm text-muted-foreground">
          ยังไม่มีข้อมูลชุดนี้ กดสั่ง worker จับคู่ใหม่หลังวางไฟล์ statement แล้ว
        </p>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-lg border md:hidden">
            {payouts.map((row) => (
              <li key={row.payout_key}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-3 py-3 text-left active:bg-slate-50"
                  onClick={() => openPayout(row.payout_key)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {platformLabel(row.platform)} · {row.shop}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatWhen(row.payout_at)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-semibold tabular-nums">
                      {formatMoney(row.amount)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>ออเดอร์ {row.order_count}</span>
                    <span>ค่าใช้จ่าย {formatMoney(row.expense_amount)}</span>
                    <span>
                      TAD {row.matched_order_count}/{row.order_count}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">วันที่</th>
                  <th className="px-3 py-2 font-medium">แพลตฟอร์ม</th>
                  <th className="px-3 py-2 font-medium">ร้าน</th>
                  <th className="px-3 py-2 text-right font-medium">ยอดเข้าบัญชี</th>
                  <th className="px-3 py-2 text-right font-medium">ออเดอร์</th>
                  <th className="px-3 py-2 text-right font-medium">ค่าใช้จ่าย</th>
                  <th className="px-3 py-2 text-right font-medium">TAD</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((row) => (
                  <tr
                    key={row.payout_key}
                    className="cursor-pointer border-t hover:bg-slate-50"
                    onClick={() => openPayout(row.payout_key)}
                  >
                    <td className="px-3 py-2">{formatWhen(row.payout_at)}</td>
                    <td className="px-3 py-2">{platformLabel(row.platform)}</td>
                    <td className="px-3 py-2">{row.shop}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(row.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.order_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(row.expense_amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.matched_order_count}/{row.order_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog
        open={selectedKey !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedKey(null);
        }}
      >
        <DialogContent
          className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(960px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
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
                : "รายละเอียดยอดโอน"}
            </DialogTitle>
            <DialogDescription className="text-left">
              {selected?.reference}
              {selected?.note ? ` — ${selected.note}` : ""}
            </DialogDescription>
            {selected ? (
              <p className="text-xs text-muted-foreground">
                ยอดในชุดนี้ {formatMoney(selected.component_net)} บาท
                {selected.source_file ? ` · ${selected.source_file}` : ""}
              </p>
            ) : null}
            <div className="flex gap-2">
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
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
            {detailLoading ? (
              <p className="py-6 text-sm text-muted-foreground">กำลังโหลดรายละเอียด</p>
            ) : visibleLines.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">ไม่มีรายการในมุมนี้</p>
            ) : (
              <ul className="flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                      {line.detail && line.detail !== line.order_id ? (
                        <p className="mt-1 text-xs text-muted-foreground">{line.detail}</p>
                      ) : null}
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">ก่อนหัก</dt>
                        <dd className="text-right tabular-nums">{formatMoney(line.gross_amount)}</dd>
                        <dt className="text-muted-foreground">ค่าใช้จ่าย</dt>
                        <dd className="text-right tabular-nums">
                          {formatMoney(line.expense_amount)}
                        </dd>
                      </dl>
                      {fees ? (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{fees}</p>
                      ) : null}
                      {receipt ? (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">
                            {receipt.receipt_no
                              ? `Peak ${receipt.receipt_no}`
                              : `Peak ${receipt.receipt_status || "ยังไม่สร้างเอกสาร"}`}
                          </span>
                          {receipt.receipt_no ? (
                            <span className="text-xs text-muted-foreground">
                              {receipt.receipt_status ? ` · ${receipt.receipt_status}` : ""}
                              {receipt.receipt_amount != null
                                ? ` · ${formatMoney(receipt.receipt_amount)}`
                                : ""}
                            </span>
                          ) : null}
                        </p>
                      ) : line.order_id && line.order_id !== "0" ? (
                        <p className="mt-2 text-xs text-muted-foreground">ไม่มีใน Peak</p>
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
                                PO {bill.po} · {bill.match_method} · {formatMoney(bill.aftertax)}
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
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums sm:text-lg">{value}</div>
    </div>
  );
}
