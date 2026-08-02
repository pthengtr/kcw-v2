"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import PoAccountDialog from "@/components/po/PoAccountDialog";
import PoPendingReceiveTab, {
  PO_ICLOW_STATUS_TABS,
} from "@/components/po/PoPendingReceiveTab";
import PoSypDetailDialog from "@/components/po/PoSypDetailDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPoAmount,
  formatPoDate,
  prepareStatusLabel,
  type PoPrepareStatus,
} from "@/lib/po/format";
import type {
  PoHeaderRow,
  PoLineRow,
  PoPendingReceiveStatus,
  PoPrepareFilter,
} from "@/lib/po/po-queries";

type PoSypView = "list" | PoPendingReceiveStatus;

function prepareBadgeVariant(
  status: PoPrepareStatus | string | null | undefined
): "default" | "secondary" | "outline" {
  switch (status) {
    case "prepared":
      return "secondary";
    case "partially_prepared":
      return "outline";
    default:
      return "default";
  }
}

export default function PoSypTab({
  refreshToken,
}: {
  refreshToken: number;
  onChanged?: () => void;
}) {
  const [view, setView] = useState<PoSypView>("list");
  const [rows, setRows] = useState<PoHeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prepare, setPrepare] = useState<PoPrepareFilter>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PoHeaderRow | null>(null);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [detailTfBillnos, setDetailTfBillnos] = useState<string | null>(null);
  const [linesLoading, setLinesLoading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountRow, setAccountRow] = useState<PoHeaderRow | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [prepare, q]);

  useEffect(() => {
    if (view !== "list") return;
    const ac = new AbortController();
    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("status", "all");
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
  }, [view, prepare, q, limit, offset, refreshToken]);

  async function openDetail(row: PoHeaderRow) {
    setSelected(row);
    setDetailTfBillnos(row.tf_billnos ?? null);
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
      const data = (await res.json()) as {
        lines: PoLineRow[];
        tf_billnos?: string | null;
      };
      setLines(data.lines ?? []);
      setDetailTfBillnos(data.tf_billnos ?? row.tf_billnos ?? null);
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
        key: "prepare_status",
        header: "เตรียมโอน",
        className: "min-w-[10rem]",
        render: (r) => (
          <div className="flex flex-col gap-1">
            <Badge variant={prepareBadgeVariant(r.prepare_status)}>
              {prepareStatusLabel(r.prepare_status)}
            </Badge>
            {r.tf_billnos ? (
              <span className="font-mono text-xs text-muted-foreground break-all">
                {r.tf_billnos}
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    []
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
            <div className="text-xs text-muted-foreground">เตรียมโอน</div>
            <Badge variant={prepareBadgeVariant(row.prepare_status)}>
              {prepareStatusLabel(row.prepare_status)}
            </Badge>
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
          {PO_ICLOW_STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="list" className="mt-3">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              SYP สั่งจาก HQ — สถานะเตรียมโอนอ่านจากบิล TF/TFV ที่ HQ (SIMas
              REMARKS ต้องมีเลข PO) ไม่ต้องติ๊กในเว็บแล้ว เมื่อ SYP รับของใน
              PARTS9 ให้ Sync PO เพื่ออัปเดตสถานะรับ
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Select
                value={prepare}
                onValueChange={(v) => setPrepare(v as PoPrepareFilter)}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="สถานะเตรียม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="not_prepared">ยังไม่เตรียม</SelectItem>
                  <SelectItem value="partially_prepared">
                    เตรียมบางส่วน
                  </SelectItem>
                  <SelectItem value="prepared">เตรียมแล้ว</SelectItem>
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
              tfBillnos={detailTfBillnos}
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

        {PO_ICLOW_STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            <PoPendingReceiveTab
              site="SYP"
              status={tab.value}
              refreshToken={refreshToken}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
