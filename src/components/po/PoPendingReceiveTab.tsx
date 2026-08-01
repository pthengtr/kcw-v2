"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SSRDatePicker } from "@/components/common/SSRDatePicker";
import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import PoAccountDialog from "@/components/po/PoAccountDialog";
import {
  formatPoDate,
  formatPoQty,
} from "@/lib/po/format";
import {
  PO_ICLOW_STATUS_TABS,
  type PoPendingReceiveDetail,
  type PoPendingReceiveRow,
  type PoPendingReceiveStatus,
} from "@/lib/po/po-queries";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

export { PO_ICLOW_STATUS_TABS };

function statusLabel(status: PoPendingReceiveStatus): string {
  return PO_ICLOW_STATUS_TABS.find((o) => o.value === status)?.label ?? status;
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
  status,
  refreshToken,
}: {
  site: PoSyncSite;
  status: PoPendingReceiveStatus;
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

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDocno, setDetailDocno] = useState<string | null>(null);
  const [detail, setDetail] = useState<PoPendingReceiveDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const showDates = status !== "to_be_ordered";
  const isBcodeQty =
    status === "pending_receive" ||
    status === "partially_received" ||
    status === "complete";
  const isPartial = status === "partially_received";

  useEffect(() => {
    setOffset(0);
  }, [q, from, to, site, status]);

  useEffect(() => {
    if (!showDates) {
      setFrom("");
      setTo("");
    }
  }, [showDates]);

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

  async function openPartialDetail(row: PoPendingReceiveRow) {
    if (!row.docno) return;
    setDetailDocno(row.docno);
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/po/pending-receive/${encodeURIComponent(row.docno)}?site=${site}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      setDetail((await res.json()) as PoPendingReceiveDetail);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }

  const lineColumns: Column<PoPendingReceiveRow>[] = useMemo(() => {
    const vendorCol: Column<PoPendingReceiveRow> = {
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
    };

    const baseCols: Column<PoPendingReceiveRow>[] = [
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
      vendorCol,
      {
        key: "acctname",
        header: "ผู้ขาย",
        className: "max-w-[12rem] hidden lg:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">
            {r.acctname ?? "—"}
          </span>
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
    ];

    if (isBcodeQty) {
      return [
        ...baseCols,
        {
          key: "ordered_qty",
          header: "สั่ง",
          className: "text-right whitespace-nowrap",
          render: (r) => (
            <span>
              {formatPoQty(r.ordered_qty ?? r.qty)}
              {r.ui ? ` ${r.ui}` : ""}
            </span>
          ),
        },
        {
          key: "received_qty",
          header: site === "HQ" ? "รับ (PIDET)" : "รับ",
          className: "text-right whitespace-nowrap",
          render: (r) => formatPoQty(r.received_qty ?? 0),
        },
        {
          key: "missing_qty",
          header: "ค้าง",
          className: "text-right whitespace-nowrap",
          render: (r) =>
            formatPoQty(
              r.missing_qty ??
                Math.max((r.ordered_qty ?? r.qty) - (r.received_qty ?? 0), 0)
            ),
        },
        {
          key: "billno",
          header: "RCVDNO",
          className: "whitespace-nowrap font-mono hidden xl:table-cell",
          render: (r) => r.billno ?? r.rcvdno ?? "—",
        },
      ];
    }

    return [
      ...baseCols,
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
    ];
  }, [isBcodeQty, site]);

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
          {isBcodeQty ? (
            <>
              <div>
                <div className="text-xs text-muted-foreground">สั่ง / รับ / ค้าง</div>
                <div className="font-semibold">
                  {formatPoQty(row.ordered_qty ?? row.qty)} /{" "}
                  {formatPoQty(row.received_qty ?? 0)} /{" "}
                  {formatPoQty(
                    row.missing_qty ??
                      Math.max(
                        (row.ordered_qty ?? row.qty) - (row.received_qty ?? 0),
                        0
                      )
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">RCVDNO</div>
                <div className="font-mono break-all">
                  {row.billno || row.rcvdno || "—"}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="text-xs text-muted-foreground">จำนวน</div>
              <div className="font-semibold">
                {formatPoQty(row.qty)}
                {row.ui ? ` ${row.ui}` : ""}
              </div>
            </div>
          )}
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
        {isBcodeQty
          ? site === "HQ"
            ? "เกรน DOCNO+BCODE — สั่งจาก ICLOW; รับจาก PIDET ผ่าน RCVDNO (ไม่ใช้ PIMAS.PO). RECEIVED=Y = รับแล้วหรือรับบางส่วนตามจำนวน PIDET"
            : "เกรน DOCNO+BCODE — สั่ง/รับจาก ICLOW (ไม่มี PIDET ที่ SYP)"
          : "แยกจากรายการ PO (POMAS/PODET) — ข้อมูลจาก ICLOW อย่างเดียว"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="w-full sm:max-w-xs"
          placeholder={
            isBcodeQty
              ? "ค้นหา DOCNO / BCODE / RCVDNO / ผู้ขาย"
              : "ค้นหา DOCNO / BCODE / ผู้ขาย"
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {showDates ? (
          <>
            <SSRDatePicker
              name="from-date"
              placeholder="จากวันที่"
              value={from || undefined}
              onChange={(val) => setFrom(val ?? "")}
              className="sm:w-[180px]"
              clearable
            />
            <SSRDatePicker
              name="to-date"
              placeholder="ถึงวันที่"
              value={to || undefined}
              onChange={(val) => setTo(val ?? "")}
              className="sm:w-[180px]"
              clearable
            />
          </>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ServerPagedTable
        columns={lineColumns}
        rows={rows}
        count={count}
        limit={limit}
        offset={offset}
        onOffsetChange={setOffset}
        onLimitChange={setLimit}
        loading={loading}
        tableMinWidthClassName="min-w-[56rem]"
        rowKey={(row) => row.id || `${row.docno}-${row.bcode}`}
        onRowClick={isPartial ? openPartialDetail : undefined}
        mobileCardRender={renderMobileCard}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รับบางส่วน — {detailDocno}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : null}
          {detailError ? (
            <p className="text-sm text-destructive">{detailError}</p>
          ) : null}
          {detail ? (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <div>
                  ผู้ขาย: {detail.acctname ?? "—"} ({detail.vendor ?? "—"})
                </div>
                <div>วันที่ (ICLOW DOCDATE): {formatPoDate(detail.docdate)}</div>
                <div>
                  BCODE ค้าง qty {detail.missing_count} · รับบน ICLOW{" "}
                  {detail.received_iclow_count} · แสดงรับ{" "}
                  {detail.received_display_count}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  ของที่ยังค้าง (สั่ง − PIDET ผ่าน RCVDNO)
                </h3>
                <ScrollArea className="max-h-[28vh] rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2">BCODE</th>
                        <th className="p-2">รายละเอียด</th>
                        <th className="p-2 text-right">ค้าง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.missing.length === 0 ? (
                        <tr>
                          <td className="p-2" colSpan={3}>
                            ไม่มีรายการค้าง
                          </td>
                        </tr>
                      ) : (
                        detail.missing.map((line, i) => (
                          <tr
                            key={line.id ?? `${line.bcode}-${i}`}
                            className="border-b"
                          >
                            <td className="p-2 font-mono">
                              {line.bcode ?? "—"}
                            </td>
                            <td className="p-2">{line.descr ?? "—"}</td>
                            <td className="p-2 text-right whitespace-nowrap">
                              {formatPoQty(line.qty)}
                              {line.ui ? ` ${line.ui}` : ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  ของที่รับแล้ว
                  {site === "HQ"
                    ? " (RCVDNO → PIDET, หรือ ICLOW ถ้าไม่เจอใบ)"
                    : " (ICLOW RECEIVED=Y)"}
                </h3>
                <ScrollArea className="max-h-[28vh] rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2">ที่มา</th>
                        <th className="p-2">RCVDNO</th>
                        <th className="p-2">BCODE</th>
                        <th className="p-2">รายละเอียด</th>
                        <th className="p-2 text-right">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.received.length === 0 ? (
                        <tr>
                          <td className="p-2" colSpan={5}>
                            ไม่พบรายการรับ
                          </td>
                        </tr>
                      ) : (
                        detail.received.map((line, i) => (
                          <tr
                            key={`${line.source}-${line.billno}-${line.bcode}-${i}`}
                            className="border-b"
                          >
                            <td className="p-2">
                              <Badge variant="outline" className="font-normal">
                                {line.source}
                              </Badge>
                            </td>
                            <td className="p-2 font-mono whitespace-nowrap">
                              {line.billno ?? "—"}
                              <div className="text-xs text-muted-foreground">
                                {formatPoDate(line.billdate)}
                              </div>
                            </td>
                            <td className="p-2 font-mono">
                              {line.bcode ?? "—"}
                            </td>
                            <td className="p-2">{line.descr ?? "—"}</td>
                            <td className="p-2 text-right whitespace-nowrap">
                              {formatPoQty(line.qty)}
                              {line.ui ? ` ${line.ui}` : ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
