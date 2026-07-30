"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import PoAccountDialog from "@/components/po/PoAccountDialog";
import PoPendingReceiveTab from "@/components/po/PoPendingReceiveTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  billedLabel,
  formatPoAmount,
  formatPoDate,
} from "@/lib/po/format";
import type { PoHeaderRow, PoLineRow } from "@/lib/po/po-queries";

export default function PoHqTab({ refreshToken }: { refreshToken: number }) {
  const [view, setView] = useState<"list" | "pending">("list");
  const [rows, setRows] = useState<PoHeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"open" | "billed" | "all">("open");
  const [q, setQ] = useState("");
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
  }, [status, q]);

  useEffect(() => {
    if (view !== "list") return;
    const ac = new AbortController();
    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("status", status);
        if (q.trim()) params.set("q", q.trim());
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
        setRows(data.rows ?? []);
        setCount(data.count ?? null);
      } catch (e) {
        if (String(e).includes("AbortError")) return;
        setError(e instanceof Error ? e.message : String(e));
        setRows([]);
        setCount(null);
      } finally {
        setLoading(false);
      }
    }
    void fetchRows();
    return () => ac.abort();
  }, [view, status, q, limit, offset, refreshToken]);

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
        key: "acctname",
        header: "ผู้ขาย",
        className: "max-w-[14rem] hidden lg:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.acctname ?? "—"}</span>
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
        <div className="mt-3 grid gap-2">
          <div>
            <div className="text-xs text-muted-foreground">ผู้ขาย</div>
            <div className="text-sm line-clamp-2 break-words">
              {row.acctname || "—"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">ACCTNO</div>
              <div className="text-sm font-mono break-all">
                {row.acctno || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ยอด</div>
              <div className="text-sm font-medium whitespace-nowrap">
                {formatPoAmount(row.aftertax)}
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as typeof view)}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="list">รายการ PO</TabsTrigger>
          <TabsTrigger value="pending">รอรับของ (ทดลองใช้)</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as typeof status)}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">เปิด</SelectItem>
                  <SelectItem value="billed">รับแล้ว</SelectItem>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="w-full sm:max-w-xs"
                placeholder="ค้นหา DOCNO / ผู้ขาย"
                value={q}
                onChange={(e) => setQ(e.target.value)}
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
              tableMinWidthClassName="min-w-[40rem]"
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
                      ผู้ขาย: {selected.acctname ?? "—"} (
                      {selected.acctno ?? "—"})
                    </div>
                    <div>
                      วันที่: {formatPoDate(selected.docdate)} · สถานะ:{" "}
                      {billedLabel(selected.billed)}
                    </div>
                    <div>ยอด: {formatPoAmount(selected.aftertax)}</div>
                  </div>
                ) : null}
                <ScrollArea className="max-h-[50vh] rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2">Line</th>
                        <th className="p-2">BCODE</th>
                        <th className="p-2">รายละเอียด</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">ราคา</th>
                        <th className="p-2">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linesLoading ? (
                        <tr>
                          <td className="p-2" colSpan={6}>
                            กำลังโหลดรายการ…
                          </td>
                        </tr>
                      ) : lines.length === 0 ? (
                        <tr>
                          <td className="p-2" colSpan={6}>
                            ไม่มีรายการ
                          </td>
                        </tr>
                      ) : (
                        lines.map((line, i) => (
                          <tr key={`${line.line}-${i}`} className="border-b">
                            <td className="p-2">{line.line ?? "—"}</td>
                            <td className="p-2">{line.bcode ?? "—"}</td>
                            <td className="p-2">{line.detail ?? "—"}</td>
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
                </ScrollArea>
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
        </TabsContent>

        <TabsContent value="pending" className="mt-3">
          <PoPendingReceiveTab site="HQ" refreshToken={refreshToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
