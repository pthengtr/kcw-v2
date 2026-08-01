"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import PoAccountDialog from "@/components/po/PoAccountDialog";
import {
  formatPoDate,
  formatPoQty,
} from "@/lib/po/format";
import type {
  PoPendingReceiveRow,
  PoPendingReceiveStatus,
} from "@/lib/po/po-queries";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

const STATUS_OPTIONS: {
  value: PoPendingReceiveStatus;
  label: string;
}[] = [
  { value: "to_be_ordered", label: "รอสั่ง" },
  { value: "pending_receive", label: "ค้างรับ" },
  { value: "partially_received", label: "รับบางส่วน" },
  { value: "complete", label: "รับแล้ว" },
];

function statusLabel(status: PoPendingReceiveStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function statusBadgeVariant(
  status: PoPendingReceiveStatus
): "default" | "secondary" | "outline" {
  switch (status) {
    case "to_be_ordered":
      return "secondary";
    case "pending_receive":
      return "default";
    case "partially_received":
      return "outline";
    case "complete":
      return "secondary";
    default:
      return "outline";
  }
}

export default function PoPendingReceiveTab({
  site,
  refreshToken,
}: {
  site: PoSyncSite;
  refreshToken: number;
}) {
  const [rows, setRows] = useState<PoPendingReceiveRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] =
    useState<PoPendingReceiveStatus>("pending_receive");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountRow, setAccountRow] = useState<PoPendingReceiveRow | null>(
    null
  );

  const showDates = status !== "to_be_ordered";

  useEffect(() => {
    setOffset(0);
  }, [q, from, to, site, status]);

  useEffect(() => {
    const ac = new AbortController();
    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("site", site);
        params.set("status", status);
        if (q.trim()) params.set("q", q.trim());
        if (showDates && from.trim()) params.set("from", from.trim());
        if (showDates && to.trim()) params.set("to", to.trim());
        if (showDates && !from.trim() && !to.trim()) params.set("months", "12");
        params.set("limit", String(limit));
        params.set("offset", String(offset));

        const res = await fetch(`/api/po/pending-receive?${params}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as {
          rows: PoPendingReceiveRow[];
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
  }, [site, status, q, from, to, limit, offset, refreshToken, showDates]);

  const columns: Column<PoPendingReceiveRow>[] = useMemo(
    () => [
      {
        key: "status",
        header: "สถานะ",
        className: "whitespace-nowrap",
        render: (r) => (
          <Badge variant={statusBadgeVariant(r.status)}>
            {statusLabel(r.status)}
          </Badge>
        ),
      },
      {
        key: "docno",
        header: "DOCNO",
        className: "whitespace-nowrap",
        render: (r) => (
          <span className="font-medium">{r.docno ?? "—"}</span>
        ),
      },
      {
        key: "docdate",
        header: "วันที่",
        className: "whitespace-nowrap",
        render: (r) => formatPoDate(r.docdate),
      },
      {
        key: "vendor",
        header: "VENDOR",
        className: "whitespace-nowrap",
        render: (r) =>
          r.vendor ? (
            <button
              type="button"
              className="font-mono text-left text-primary underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setAccountRow(r);
                setAccountOpen(true);
              }}
            >
              {r.vendor}
            </button>
          ) : (
            "—"
          ),
      },
      {
        key: "acctname",
        header: "ผู้ขาย",
        className: "max-w-[12rem] hidden lg:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.acctname ?? "—"}</span>
        ),
      },
      {
        key: "bcode",
        header: "BCODE",
        className: "whitespace-nowrap font-mono",
        render: (r) => r.bcode ?? "—",
      },
      {
        key: "descr",
        header: "รายละเอียด",
        className: "max-w-[14rem] hidden md:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.descr ?? "—"}</span>
        ),
      },
      {
        key: "qty",
        header: "จำนวน",
        className: "text-right whitespace-nowrap",
        render: (r) => (
          <span>
            {formatPoQty(r.qty)}
            {r.ui ? ` ${r.ui}` : ""}
          </span>
        ),
      },
      {
        key: "rcvddate",
        header: "วันรับ",
        className: "whitespace-nowrap hidden xl:table-cell",
        render: (r) => formatPoDate(r.rcvddate),
      },
      {
        key: "rcvdno",
        header: "เลขรับ",
        className: "whitespace-nowrap hidden xl:table-cell font-mono",
        render: (r) => r.rcvdno ?? "—",
      },
    ],
    []
  );

  function renderMobileCard(row: PoPendingReceiveRow) {
    return (
      <div className="w-full rounded-md border bg-white p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium break-all">{row.docno || "—"}</div>
          <Badge variant={statusBadgeVariant(row.status)}>
            {statusLabel(row.status)}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatPoDate(row.docdate)}
        </div>
        <div className="mt-2 text-sm line-clamp-2 break-words">
          {row.acctname || row.vendor || "—"}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">BCODE</div>
            <div className="font-mono break-all">{row.bcode || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">จำนวน</div>
            <div className="font-semibold">
              {formatPoQty(row.qty)}
              {row.ui ? ` ${row.ui}` : ""}
            </div>
          </div>
        </div>
        {row.descr ? (
          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {row.descr}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        รายการจาก ICLOW (PARTS9) — แยกสถานะ รอสั่ง / ค้างรับ / รับบางส่วน /
        รับแล้ว ตามธง ORDERED·RECEIVED
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PoPendingReceiveStatus)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-full sm:max-w-xs"
          placeholder="ค้นหา DOCNO / BCODE / ผู้ขาย"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {showDates ? (
          <>
            <Input
              type="date"
              className="w-full sm:w-[160px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="จากวันที่"
            />
            <Input
              type="date"
              className="w-full sm:w-[160px]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="ถึงวันที่"
            />
          </>
        ) : null}
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
        loading={loading}
        tableMinWidthClassName="min-w-[56rem]"
        rowKey={(row) => row.id || `${row.docno}-${row.bcode}`}
        mobileCardRender={renderMobileCard}
      />

      <PoAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        acctno={accountRow?.vendor ?? null}
        site={site}
        docno={accountRow?.docno}
        fallbackName={accountRow?.acctname}
      />
    </div>
  );
}
