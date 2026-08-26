"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import PoBranchTabs from "@/components/po/PoBranchTabs";
import PoAccountDialog from "@/components/po/PoAccountDialog";
import { PoDateLookbackControls } from "@/components/po/PoDateLookbackControls";
import PoProductCell from "@/components/po/PoProductCell";
import {
  billedLabel,
  formatPoAmount,
  formatPoDate,
  last30DaysPoDateRange,
} from "@/lib/po/format";
import type {
  PoHeaderRow,
  PoLineRow,
  PoPendingReceiveStatus,
} from "@/lib/po/po-queries";

type PoHqView = "list" | PoPendingReceiveStatus;

export default function PoHqTab({ refreshToken }: { refreshToken: number }) {
  const [view, setView] = useState<PoHqView>("list");
  const [rows, setRows] = useState<PoHeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState(() => last30DaysPoDateRange().from);
  const [to, setTo] = useState(() => last30DaysPoDateRange().to);
  const [lookbackId, setLookbackId] = useState("30d");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PoHeaderRow | null>(null);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountRow, setAccountRow] = useState<PoHeaderRow | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [q, from, to]);

  useEffect(() => {
    if (view !== "list") return;
    const ac = new AbortController();
    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("status", "all");
        if (q.trim()) params.set("q", q.trim());
        const range = last30DaysPoDateRange();
        params.set("from", from.trim() || range.from);
        params.set("to", to.trim() || range.to);
        params.set("limit", String(limit));
        params.set("offset", String(offset));

        const res = await fetch(`/api/po/hq?${params}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as {
          rows: PoHeaderRow[];
          count: number | null;
        };
        if (ac.signal.aborted) return;
        setRows(data.rows ?? []);
        setCount(data.count ?? null);
      } catch (e) {
        if (ac.signal.aborted || String(e).includes("AbortError")) return;
        setError(e instanceof Error ? e.message : String(e));
        setRows([]);
        setCount(null);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }
    void fetchRows();
    return () => ac.abort();
  }, [view, q, from, to, limit, offset, refreshToken]);

  async function openDetail(row: PoHeaderRow) {
    setSelected(row);
    setOpen(true);
    setLines([]);
    setLinesLoading(true);
    try {
      const res = await fetch(`/api/po/hq/${encodeURIComponent(row.docno)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { lines: PoLineRow[] };
      setLines(data.lines ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinesLoading(false);
    }
  }

  const columns: Column<PoHeaderRow>[] = useMemo(
    () => [
      {
        key: "docno",
        header: "DOCNO",
        className: "whitespace-nowrap",
        render: (r) => <span className="font-medium">{r.docno}</span>,
      },
      {
        key: "docdate",
        header: "วันที่",
        className: "whitespace-nowrap",
        render: (r) => formatPoDate(r.docdate),
      },
      {
        key: "acctno",
        header: "ACCTNO",
        className: "whitespace-nowrap",
        render: (r) =>
          r.acctno ? (
            <button
              type="button"
              className="font-mono text-left text-primary underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setAccountRow(r);
                setAccountOpen(true);
              }}
            >
              {r.acctno}
            </button>
          ) : (
            "—"
          ),
      },
      {
        key: "aftertax",
        header: "ยอด",
        className: "text-right whitespace-nowrap",
        render: (r) => formatPoAmount(r.aftertax),
      },
    ],
    []
  );

  function renderPoHqMobileCard(row: PoHeaderRow) {
    return (
      <button
        type="button"
        onClick={() => void openDetail(row)}
        className="w-full rounded-md border bg-white p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium break-all">{row.docno}</div>
          <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
            {formatPoDate(row.docdate)}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">ACCTNO</div>
            <div className="text-sm font-mono break-all">{row.acctno || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ยอด</div>
            <div className="text-sm font-medium whitespace-nowrap">
              {formatPoAmount(row.aftertax)}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PoBranchTabs
        site="HQ"
        view={view}
        onViewChange={setView}
        refreshToken={refreshToken}
        listContent={
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              ใบสั่งซื้อที่สั่งจากซัพพลายเออร์เข้ามาที่ HQ
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                className="w-full sm:max-w-xs"
                placeholder="ค้นหา DOCNO / ACCTNO"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <PoDateLookbackControls
                from={from}
                to={to}
                lookbackId={lookbackId}
                onFromChange={setFrom}
                onToChange={setTo}
                onLookbackIdChange={setLookbackId}
                onRangeChange={(range) => {
                  setFrom(range.from);
                  setTo(range.to);
                }}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <ServerPagedTable
              columns={columns}
              rows={rows}
              count={count}
              limit={limit}
              offset={offset}
              onOffsetChange={setOffset}
              onLimitChange={setLimit}
              onRowClick={openDetail}
              loading={loading}
              tableMinWidthClassName="min-w-[36rem]"
              rowKey={(row) => row.docno}
              mobileCardRender={renderPoHqMobileCard}
            />

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>HQ PO {selected?.docno}</DialogTitle>
                </DialogHeader>
                {selected ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      ACCTNO: {selected.acctno ?? "—"} · วันที่:{" "}
                      {formatPoDate(selected.docdate)} · สถานะ:{" "}
                      {billedLabel(selected.billed)}
                    </div>
                    <div>ยอด: {formatPoAmount(selected.aftertax)}</div>
                  </div>
                ) : null}
                <div className="max-h-[50vh] overflow-auto rounded-md border">
                  <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="sticky top-0 z-10 border-b bg-muted p-2">
                          BCODE
                        </th>
                        <th className="sticky top-0 z-10 border-b bg-muted p-2">
                          สินค้า
                        </th>
                        <th className="sticky top-0 z-10 border-b bg-muted p-2">
                          Qty
                        </th>
                        <th className="sticky top-0 z-10 border-b bg-muted p-2">
                          ราคา
                        </th>
                        <th className="sticky top-0 z-10 border-b bg-muted p-2">
                          จำนวนเงิน
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {linesLoading ? (
                        <tr>
                          <td className="p-2" colSpan={5}>
                            กำลังโหลดรายการ…
                          </td>
                        </tr>
                      ) : lines.length === 0 ? (
                        <tr>
                          <td className="p-2" colSpan={5}>
                            ไม่มีรายการ
                          </td>
                        </tr>
                      ) : (
                        lines.map((line, i) => (
                          <tr key={`${line.line}-${i}`} className="border-b">
                            <td className="p-2 font-mono">{line.bcode ?? "—"}</td>
                            <td className="p-2">
                              <PoProductCell
                                detail={line.detail}
                                mcode={line.mcode}
                              />
                            </td>
                            <td className="p-2">
                              {line.qty ?? "—"} {line.ui ?? ""}
                            </td>
                            <td className="p-2">{formatPoAmount(line.price)}</td>
                            <td className="p-2">
                              {formatPoAmount(line.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>

            <PoAccountDialog
              open={accountOpen}
              onOpenChange={setAccountOpen}
              acctno={accountRow?.acctno ?? null}
              site="HQ"
              docno={accountRow?.docno}
              fallbackName={accountRow?.acctname}
            />
          </div>
        }
      />
    </div>
  );
}
