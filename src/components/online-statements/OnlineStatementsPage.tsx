"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

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
    timeStyle: value.includes("T") && !value.endsWith("T00:00:00+07:00") ? "short" : undefined,
  }).format(date);
}

function platformLabel(platform: string): string {
  return PLATFORMS.find((item) => item.id === platform)?.label ?? platform;
}

export default function OnlineStatementsPage() {
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("transferred");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ platform, status });
    const res = await fetch(`/api/online-statements?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "โหลดรายการไม่สำเร็จ");
      setPayouts([]);
    } else {
      setPayouts(json.payouts ?? []);
    }
    setLoading(false);
  }, [platform, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedKey) {
      setLines([]);
      setBills([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    const params = new URLSearchParams({ payout: selectedKey });
    void fetch(`/api/online-statements/detail?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดรายละเอียดไม่สำเร็จ");
        if (!cancelled) {
          setLines(json.lines ?? []);
          setBills(json.bills ?? []);
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
  const billsByOrder = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const bill of bills) {
      const list = map.get(bill.order_id) ?? [];
      list.push(bill);
      map.set(bill.order_id, list);
    }
    return map;
  }, [bills]);

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">เงินเข้าออนไลน์</h1>
          <p className="text-sm text-muted-foreground">
            ยอดที่โอนเข้าบัญชี แยกตามแพลตฟอร์ม แล้วไล่ไปออเดอร์ ค่าธรรมเนียม และบิล TAD
          </p>
        </div>
        <Button type="button" onClick={() => void rebuild()} disabled={syncing}>
          {syncing ? "กำลังจับคู่..." : "สั่ง worker จับคู่ใหม่"}
        </Button>
      </div>

      {job ? (
        <p className="text-sm text-muted-foreground">
          งาน #{job.id} {job.status}
          {job.worker_name ? ` · ${job.worker_name}` : ""}
          {job.error_message ? ` · ${job.error_message}` : ""}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
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
          variant={status === "pending" ? "default" : "outline"}
          onClick={() => {
            setStatus("pending");
            setSelectedKey(null);
          }}
        >
          ยังไม่โอน
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="ยอดเงิน" value={formatMoney(totals.amount)} />
        <Summary label="ค่าใช้จ่ายในชุดนี้" value={formatMoney(totals.expense)} />
        <Summary label="ออเดอร์" value={String(totals.orders)} />
        <Summary label="จับคู่ TAD แล้ว" value={String(totals.matched)} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
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
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                  กำลังโหลด
                </td>
              </tr>
            ) : payouts.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={7}>
                  ยังไม่มีข้อมูลชุดนี้ กดสั่ง worker จับคู่ใหม่หลังวางไฟล์ statement แล้ว
                </td>
              </tr>
            ) : (
              payouts.map((row) => (
                <tr
                  key={row.payout_key}
                  className={
                    row.payout_key === selectedKey
                      ? "cursor-pointer bg-violet-50"
                      : "cursor-pointer hover:bg-slate-50"
                  }
                  onClick={() => setSelectedKey(row.payout_key)}
                >
                  <td className="px-3 py-2">{formatWhen(row.payout_at)}</td>
                  <td className="px-3 py-2">{platformLabel(row.platform)}</td>
                  <td className="px-3 py-2">{row.shop}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.order_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.expense_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.matched_order_count}/{row.order_count}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <div>
            <h2 className="font-medium">
              {platformLabel(selected.platform)} {selected.shop} · {formatMoney(selected.amount)} บาท
            </h2>
            <p className="text-sm text-muted-foreground">
              {selected.reference}
              {selected.note ? ` — ${selected.note}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              ยอดออเดอร์และรายการปรับในชุดนี้ {formatMoney(selected.component_net)} บาท
              {selected.source_file ? ` · ${selected.source_file}` : ""}
            </p>
          </div>
          {detailLoading ? <p className="text-sm text-muted-foreground">กำลังโหลดรายละเอียด</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left">
                <tr>
                  <th className="px-2 py-1 font-medium">ออเดอร์</th>
                  <th className="px-2 py-1 text-right font-medium">ก่อนหัก</th>
                  <th className="px-2 py-1 text-right font-medium">ค่าใช้จ่าย</th>
                  <th className="px-2 py-1 text-right font-medium">สุทธิ</th>
                  <th className="px-2 py-1 font-medium">ค่าธรรมเนียม</th>
                  <th className="px-2 py-1 font-medium">บิล TAD</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const linked = line.order_id ? billsByOrder.get(line.order_id) ?? [] : [];
                  const feeText = (line.fees ?? [])
                    .filter((fee) => num(fee.amount) < 0)
                    .map((fee) => `${fee.name} ${formatMoney(fee.amount)}`)
                    .join(", ");
                  return (
                    <tr key={line.line_no} className="border-t align-top">
                      <td className="px-2 py-2">
                        <div>{line.order_id || line.fee_name || "รายการปรับ"}</div>
                        {line.detail && line.detail !== line.order_id ? (
                          <div className="text-xs text-muted-foreground">{line.detail}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(line.gross_amount)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(line.expense_amount)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(line.net_amount)}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{feeText || "—"}</td>
                      <td className="px-2 py-2">
                        {linked.length === 0 ? (
                          <span className="text-muted-foreground">ยังไม่พบ PO</span>
                        ) : (
                          linked.map((bill) => (
                            <div key={bill.billno}>
                              <span className="font-medium">{bill.billno}</span>
                              {bill.canceled ? " (ยกเลิก)" : ""}
                              <div className="text-xs text-muted-foreground">
                                PO {bill.po} · {bill.match_method} · {formatMoney(bill.aftertax)}
                                {bill.acctname ? ` · ${bill.acctname}` : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
