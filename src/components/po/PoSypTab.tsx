"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  formatPoTs,
} from "@/lib/po/format";
import type { PoHeaderRow, PoLineRow } from "@/lib/po/po-queries";

function billedVariant(billed: string | null | undefined): BadgeProps["variant"] {
  if (billed === "Y") return "secondary";
  return "outline";
}

export default function PoSypTab({
  refreshToken,
  onChanged,
}: {
  refreshToken: number;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<PoHeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDocno, setSavingDocno] = useState<string | null>(null);

  const [status, setStatus] = useState<"open" | "billed" | "all">("open");
  const [prepare, setPrepare] = useState<
    "all" | "prepared" | "not_prepared"
  >("not_prepared");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PoHeaderRow | null>(null);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    setOffset(0);
  }, [status, prepare, q]);

  useEffect(() => {
    const ac = new AbortController();
    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("status", status);
        params.set("prepare", prepare);
        if (q.trim()) params.set("q", q.trim());
        params.set("limit", String(limit));
        params.set("offset", String(offset));

        const res = await fetch(`/api/po/syp?${params}`, {
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
  }, [status, prepare, q, limit, offset, refreshToken]);

  async function setPrepared(row: PoHeaderRow, prepared: boolean, note?: string) {
    setSavingDocno(row.docno);
    setError(null);
    try {
      const res = await fetch(
        `/api/po/syp/${encodeURIComponent(row.docno)}/prepare`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prepared,
            note: note ?? row.note ?? null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        row: {
          docno: string;
          prepared: boolean;
          prepared_at: string | null;
          prepared_by: string | null;
          note: string | null;
        };
      };
      setRows((prev) =>
        prev.map((r) =>
          r.docno === row.docno
            ? {
                ...r,
                prepared: data.row.prepared,
                prepared_at: data.row.prepared_at,
                prepared_by: data.row.prepared_by,
                note: data.row.note,
              }
            : r
        )
      );
      if (selected?.docno === row.docno) {
        setSelected((s) =>
          s
            ? {
                ...s,
                prepared: data.row.prepared,
                prepared_at: data.row.prepared_at,
                prepared_by: data.row.prepared_by,
                note: data.row.note,
              }
            : s
        );
      }
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDocno(null);
    }
  }

  async function openDetail(row: PoHeaderRow) {
    setSelected(row);
    setNoteDraft(row.note ?? "");
    setOpen(true);
    setLines([]);
    setLinesLoading(true);
    try {
      const res = await fetch(`/api/po/syp/${encodeURIComponent(row.docno)}`, {
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
        key: "aftertax",
        header: "ยอด",
        render: (r) => formatPoAmount(r.aftertax),
      },
      {
        key: "billed",
        header: "PARTS9",
        render: (r) => (
          <Badge variant={billedVariant(r.billed)}>
            {billedLabel(r.billed)}
          </Badge>
        ),
      },
      {
        key: "prepared",
        header: "เตรียมแล้ว",
        render: (r) => (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={Boolean(r.prepared)}
              disabled={savingDocno === r.docno}
              onCheckedChange={(checked) => void setPrepared(r, checked)}
            />
            {r.prepared_at ? (
              <span className="text-xs text-muted-foreground">
                {formatPoTs(r.prepared_at)}
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savingDocno]
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        SYP สั่งจาก HQ — ทำเครื่องหมายเมื่อเตรียมสินค้าโอนแล้ว จากนั้นเมื่อ SYP
        รับของและคีย์ใน PARTS9 ให้ Sync เพื่ออัปเดตสถานะ
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">เปิด</SelectItem>
            <SelectItem value="billed">รับแล้ว</SelectItem>
            <SelectItem value="all">ทั้งหมด</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={prepare}
          onValueChange={(v) => setPrepare(v as typeof prepare)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="เตรียม" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_prepared">ยังไม่เตรียม</SelectItem>
            <SelectItem value="prepared">เตรียมแล้ว</SelectItem>
            <SelectItem value="all">เตรียมทั้งหมด</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-full sm:max-w-xs"
          placeholder="ค้นหา DOCNO"
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
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>SYP PO {selected?.docno}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div>
                วันที่: {formatPoDate(selected.docdate)} · PARTS9:{" "}
                {billedLabel(selected.billed)} · ยอด:{" "}
                {formatPoAmount(selected.aftertax)}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={Boolean(selected.prepared)}
                    disabled={savingDocno === selected.docno}
                    onCheckedChange={(checked) =>
                      void setPrepared(selected, checked, noteDraft)
                    }
                  />
                  <span>เตรียมแล้ว</span>
                </div>
                {selected.prepared_at ? (
                  <span className="text-muted-foreground">
                    {formatPoTs(selected.prepared_at)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="หมายเหตุ (ถ้ามี)"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingDocno === selected.docno}
                  onClick={() =>
                    void setPrepared(
                      selected,
                      Boolean(selected.prepared),
                      noteDraft
                    )
                  }
                >
                  บันทึกหมายเหตุ
                </Button>
              </div>
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
