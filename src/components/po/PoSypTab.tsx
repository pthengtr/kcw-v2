"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import PoSypDetailDialog from "@/components/po/PoSypDetailDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPoAmount,
  formatPoDate,
  formatPoTs,
} from "@/lib/po/format";
import type { PoHeaderRow, PoLineRow } from "@/lib/po/po-queries";

export default function PoSypTab({
  refreshToken,
  onChanged,
}: {
  refreshToken: number;
  onChanged?: () => void;
}) {
  const [view, setView] = useState<"list" | "pending">("list");
  const [rows, setRows] = useState<PoHeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDocno, setSavingDocno] = useState<string | null>(null);
  const [savingLine, setSavingLine] = useState<string | null>(null);

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountRow, setAccountRow] = useState<PoHeaderRow | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [status, prepare, q]);

  useEffect(() => {
    if (view !== "list") return;
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
  }, [view, status, prepare, q, limit, offset, refreshToken]);

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
          lines?: PoLineRow[];
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
        if (data.row.lines) setLines(data.row.lines);
      }
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDocno(null);
    }
  }

  async function setLinePrepared(line: PoLineRow, prepared: boolean) {
    if (!selected?.docno || !line.line) return;
    const key = `${selected.docno}:${line.line}`;
    setSavingLine(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/po/syp/${encodeURIComponent(selected.docno)}/lines/${encodeURIComponent(line.line)}/prepare`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prepared }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        headerPrepared: boolean;
        lines: PoLineRow[];
      };
      setLines(data.lines ?? []);
      setRows((prev) =>
        prev.map((r) =>
          r.docno === selected.docno
            ? { ...r, prepared: data.headerPrepared }
            : r
        )
      );
      setSelected((s) =>
        s ? { ...s, prepared: data.headerPrepared } : s
      );
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingLine(null);
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
      {
        key: "prepared",
        header: "เตรียมแล้ว",
        className: "min-w-[9rem]",
        render: (r) => (
          <div
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={Boolean(r.prepared)}
              disabled={savingDocno === r.docno}
              onCheckedChange={(checked) => void setPrepared(r, checked)}
            />
            {r.prepared_at ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
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

  function renderPoSypMobileCard(row: PoHeaderRow) {
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
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">เตรียมแล้ว</div>
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Switch
                checked={Boolean(row.prepared)}
                disabled={savingDocno === row.docno}
                onCheckedChange={(checked) => void setPrepared(row, checked)}
              />
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
          <TabsTrigger value="pending">รอรับของ (ICLOW)</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              SYP สั่งจาก HQ — ทำเครื่องหมายเมื่อเตรียมสินค้าโอนแล้ว จากนั้นเมื่อ
              SYP รับของและคีย์ใน PARTS9 ให้ Sync เพื่ออัปเดตสถานะ
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
              tableMinWidthClassName="min-w-[44rem]"
              rowKey={(row) => row.docno}
              mobileCardRender={renderPoSypMobileCard}
            />

            <PoSypDetailDialog
              open={open}
              onOpenChange={setOpen}
              selected={selected}
              lines={lines}
              linesLoading={linesLoading}
              savingDocno={savingDocno}
              savingLine={savingLine}
              noteDraft={noteDraft}
              onNoteDraftChange={setNoteDraft}
              onToggleHeaderPrepared={(prepared) => {
                if (!selected) return;
                void setPrepared(selected, prepared, noteDraft);
              }}
              onSaveNote={() => {
                if (!selected) return;
                void setPrepared(
                  selected,
                  Boolean(selected.prepared),
                  noteDraft
                );
              }}
              onToggleLinePrepared={(line, prepared) => {
                void setLinePrepared(line, prepared);
              }}
            />

            <PoAccountDialog
              open={accountOpen}
              onOpenChange={setAccountOpen}
              acctno={accountRow?.acctno ?? null}
              site="SYP"
              docno={accountRow?.docno}
              fallbackName={accountRow?.acctname}
            />
          </div>
        </TabsContent>

        <TabsContent value="pending" className="mt-3">
          <PoPendingReceiveTab site="SYP" refreshToken={refreshToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
