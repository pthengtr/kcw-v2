"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import PoAccountDialog from "@/components/po/PoAccountDialog";
import {
  formatPoDate,
  formatPoQty,
} from "@/lib/po/format";
import type { PoPendingReceiveRow } from "@/lib/po/po-queries";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

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

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountRow, setAccountRow] = useState<PoPendingReceiveRow | null>(
    null
  );

  useEffect(() => {
    setOffset(0);
  }, [q, from, to, site]);

  useEffect(() => {
    const ac = new AbortController();
    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("site", site);
        if (q.trim()) params.set("q", q.trim());
        if (from.trim()) params.set("from", from.trim());
        if (to.trim()) params.set("to", to.trim());
        if (!from.trim() && !to.trim()) params.set("months", "12");
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
  }, [site, q, from, to, limit, offset, refreshToken]);

  const columns: Column<PoPendingReceiveRow>[] = useMemo(
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
        className: "max-w-[12rem] hidden lg:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.acctname ?? "—"}</span>
        ),
      },
      {
        key: "line",
        header: "Line",
        className: "whitespace-nowrap",
        render: (r) => r.line ?? "—",
      },
      {
        key: "bcode",
        header: "BCODE",
        className: "whitespace-nowrap font-mono",
        render: (r) => r.bcode ?? "—",
      },
      {
        key: "detail",
        header: "รายละเอียด",
        className: "max-w-[14rem] hidden md:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.detail ?? "—"}</span>
        ),
      },
      {
        key: "po_qty",
        header: "สั่ง",
        className: "text-right whitespace-nowrap",
        render: (r) => (
          <span>
            {formatPoQty(r.po_qty)}
            {r.ui ? ` ${r.ui}` : ""}
          </span>
        ),
      },
      {
        key: "recv_qty",
        header: "รับแล้ว",
        className: "text-right whitespace-nowrap",
        render: (r) => formatPoQty(r.recv_qty),
      },
      {
        key: "remaining",
        header: "ค้างรับ",
        className: "text-right whitespace-nowrap font-semibold",
        render: (r) => (
          <span className="inline-flex items-center gap-1.5 justify-end">
            {formatPoQty(r.remaining)}
            {site === "HQ" && r.billed === "Y" ? (
              <Badge variant="outline" className="font-normal">
                รับบางส่วน
              </Badge>
            ) : null}
          </span>
        ),
      },
    ],
    [site]
  );

  function renderMobileCard(row: PoPendingReceiveRow) {
    return (
      <div className="w-full rounded-md border bg-white p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium break-all">{row.docno}</div>
          <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
            {formatPoDate(row.docdate)}
          </div>
        </div>
        <div className="mt-2 text-sm line-clamp-2 break-words">
          {row.acctname || "—"}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">BCODE</div>
            <div className="font-mono break-all">{row.bcode || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ค้างรับ</div>
            <div className="font-semibold">
              {formatPoQty(row.remaining)}
              {row.ui ? ` ${row.ui}` : ""}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">สั่ง</div>
            <div>{formatPoQty(row.po_qty)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">รับแล้ว</div>
            <div>{formatPoQty(row.recv_qty)}</div>
          </div>
        </div>
        {site === "HQ" && row.billed === "Y" ? (
          <Badge variant="outline" className="mt-2">
            รับบางส่วน
          </Badge>
        ) : null}
        {row.detail ? (
          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {row.detail}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {site === "HQ"
          ? "รายการบรรทัด PO HQ ที่ยังค้างรับ (ทดลองใช้) — จำนวนสั่ง − จำนวนที่คีย์รับแล้วตาม BCODE อาจไม่ตรงกับระบบเดิมทุกกรณี"
          : "รายการบรรทัด PO SYP ที่ยังเปิดอยู่ (ทดลองใช้) — ยังไม่มีข้อมูลคีย์รับรายบรรทัดของ SYP จึงแสดง PO ที่ยังไม่รับทั้งใบ"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="w-full sm:max-w-xs"
          placeholder="ค้นหา DOCNO / BCODE / ผู้ขาย"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
        rowKey={(row) => `${row.docno}-${row.line}-${row.bcode}`}
        mobileCardRender={renderMobileCard}
      />

      <PoAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        acctno={accountRow?.acctno ?? null}
        site={site}
        docno={accountRow?.docno}
        fallbackName={accountRow?.acctname}
      />
    </div>
  );
}
