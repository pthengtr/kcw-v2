"use client";

import { useEffect, useState } from "react";

import type { StatementLineRow } from "@/components/bank/types";
import {
  fifoMargin,
  fifoSiteForBillnos,
  indexBillFifo,
  piBillRefs,
  saleBillTakesFifo,
  type BillFifoCost,
  type FifoMargin,
} from "@/lib/bank/fifo-margin";
import { statementSalesBills } from "@/lib/bank/statement-doc-links";

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number): string {
  return money.format(Number.isFinite(value) ? value : 0);
}

export function FifoMarginSummary({ margin }: { margin: FifoMargin }) {
  if (margin.expected_bills === 0) return null;
  if (margin.status === "MISSING") {
    return <p className="mt-2 text-xs text-amber-700">ยังไม่มีต้นทุน FIFO</p>;
  }
  if (margin.status === "UNCOSTED") {
    return <p className="mt-2 text-xs text-amber-700">ยังคิดต้นทุน FIFO ไม่ได้</p>;
  }
  const refs = piBillRefs(margin.pi_bills);
  return (
    <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs">
      <div className="font-medium text-slate-700">ต้นทุน FIFO รายวัน</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">ต้นทุน</dt>
        <dd className="text-right tabular-nums">{formatMoney(margin.fifo_ext_cost)}</dd>
        <dt className="text-muted-foreground">กำไร</dt>
        <dd className="text-right tabular-nums">{formatMoney(margin.profit)}</dd>
        <dt className="text-muted-foreground">อัตรากำไร</dt>
        <dd className="text-right tabular-nums">
          {margin.margin_pct == null ? "—" : `${margin.margin_pct.toFixed(1)}%`}
        </dd>
        {refs ? (
          <>
            <dt className="text-muted-foreground">บิล PI</dt>
            <dd className="text-right break-all">{refs}</dd>
          </>
        ) : null}
      </dl>
      {margin.status !== "OK" ? (
        <p className="mt-1 text-amber-700">
          ต้นทุนยังไม่ครบ {margin.costed_bills}/{margin.expected_bills} บิล
        </p>
      ) : null}
    </div>
  );
}

export function FifoBillNote({ cost }: { cost?: BillFifoCost }) {
  if (!cost) {
    return <div className="text-xs text-amber-700">ยังไม่มีต้นทุน FIFO</div>;
  }
  const refs = piBillRefs(cost.pi_bills);
  return (
    <div className="text-xs text-muted-foreground">
      ต้นทุน FIFO {formatMoney(cost.fifo_ext_cost)}
      {refs ? ` · ${refs}` : ""}
      {cost.status !== "OK" ? " · ต้นทุนยังไม่ครบ" : ""}
    </div>
  );
}

export function PayoutFifoSummary({
  revenue,
  billnos,
  costs,
}: {
  revenue: number;
  billnos: string[];
  costs: BillFifoCost[];
}) {
  const margin = fifoMargin({ revenue, billnos, costs });
  return <FifoMarginSummary margin={margin} />;
}

export function StatementSaleFifo({ row }: { row: StatementLineRow }) {
  const billnos = (statementSalesBills(row) ?? [])
    .filter((bill) => saleBillTakesFifo(bill.billno, bill.docType))
    .map((bill) => bill.billno);
  const enabled = String(row.direction ?? "").trim().toLowerCase() === "in" && billnos.length > 0;
  const { costs, error, loading } = useSaleFifo(billnos, fifoSiteForBillnos(billnos), enabled);
  if (!enabled) return null;
  if (loading) return <p className="text-xs text-muted-foreground">กำลังโหลดต้นทุน FIFO</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;
  return (
    <FifoMarginSummary
      margin={fifoMargin({ revenue: Number(row.amount ?? 0), billnos, costs })}
    />
  );
}

export function useSaleFifo(
  billnos: string[],
  site: "hq" | "syp" | null,
  enabled: boolean
): {
  costs: BillFifoCost[];
  byBill: Map<string, BillFifoCost>;
  error: string | null;
  loading: boolean;
} {
  const requestKey = enabled
    ? JSON.stringify({
        site,
        billnos: [...new Set(billnos.map((bill) => bill.trim()).filter(Boolean))].sort(),
      })
    : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [costs, setCosts] = useState<BillFifoCost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestKey) {
      setLoadedKey("");
      setCosts([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const payload = JSON.parse(requestKey) as {
      site: "hq" | "syp" | null;
      billnos: string[];
    };
    void fetch("/api/sales-bills/fifo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดต้นทุน FIFO ไม่สำเร็จ");
        if (!cancelled) {
          setCosts(json.fifo ?? []);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCosts([]);
          setError(err instanceof Error ? err.message : "โหลดต้นทุน FIFO ไม่สำเร็จ");
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  return {
    costs,
    byBill: indexBillFifo(costs),
    error,
    loading: requestKey !== "" && loadedKey !== requestKey,
  };
}
