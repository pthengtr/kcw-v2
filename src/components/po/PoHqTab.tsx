"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
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
import {
  billedLabel,
  formatPoAmount,
  formatPoDate,
} from "@/lib/po/format";
import type { PoHeaderRow, PoLineRow } from "@/lib/po/po-queries";

function billedVariant(billed: string | null | undefined): BadgeProps["variant"] {
  if (billed === "Y") return "secondary";
  if (billed === "N") return "outline";
  return "outline";
}

export default function PoHqTab({ refreshToken }: { refreshToken: number }) {
  const [rows, setRows] = useState<PoHeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"open" | "billed" | "all">("open");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PoHeaderRow | null>(null);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);

  useEffect(() => {
    setOffset(0);
  }, [status, q]);

  useEffect(() => {
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
  }, [status, q, limit, offset, refreshToken]);

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
        render: (r) => <span className="font-medium">{r.docno}</span>,
      },
      {
        key: "docdate",
        header: "วันที่",
        render: (r) => formatPoDate(r.docdate),
      },
      {
        key: "acctname",
        header: "ผู้ขาย",
        className: "max-w-[14rem] truncate",
        render: (r) => r.acctname ?? "—",
      },
      {
        key: "aftertax",
        header: "ยอด",
        render: (r) => formatPoAmount(r.aftertax),
      },
      {
        key: "billed",
        header: "สถานะ",
        render: (r) => (
          <Badge variant={billedVariant(r.billed)}>
            {billedLabel(r.billed)}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
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
      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : null}

      <ServerPagedTable
        columns={columns}
        rows={rows}
        count={count}
        limit={limit}
        offset={offset}
        onOffsetChange={setOffset}
        onLimitChange={setLimit}
        onRowClick={openDetail}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>HQ PO {selected?.docno}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2 text-sm">
              <div>
                ผู้ขาย: {selected.acctname ?? "—"} ({selected.acctno ?? "—"})
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
                      <td className="p-2">{formatPoAmount(line.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
