"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  formatPoAmount,
  formatPoDate,
  formatPoQty,
} from "@/lib/po/format";
import {
  PO_ICLOW_STATUS_TABS,
  type PiHeader,
  type PiLineRow,
  type PoLineRow,
  type PoPendingReceiveRow,
  type PoPendingReceiveStatus,
} from "@/lib/po/po-queries";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

export { PO_ICLOW_STATUS_TABS };

type DetailKind = "po" | "pi";

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

function rcvdnoValue(row: Pick<PoPendingReceiveRow, "billno" | "rcvdno">) {
  return (row.billno ?? row.rcvdno)?.trim() || "";
}

function canOpenPiDetail(
  site: PoSyncSite,
  row: Pick<PoPendingReceiveRow, "billno" | "rcvdno" | "pimas_link_missing">
) {
  // PIMAS/PIDET live on HQ; only link when RCVDNO resolves to a bill.
  return (
    site === "HQ" &&
    Boolean(rcvdnoValue(row)) &&
    !row.pimas_link_missing
  );
}

/** HQ: annotate RCVDNO when ingested PIMAS bill is missing; otherwise link to PI detail */
function formatRcvdnoCell(
  billno: string | null | undefined,
  opts: {
    site: PoSyncSite;
    pimasLinkMissing?: boolean;
    onOpenPi?: () => void;
  }
): ReactNode {
  const value = billno?.trim() || "—";
  const showNote =
    value !== "—" && opts.site === "HQ" && Boolean(opts.pimasLinkMissing);
  const clickable =
    value !== "—" &&
    opts.site === "HQ" &&
    !opts.pimasLinkMissing &&
    typeof opts.onOpenPi === "function";

  return (
    <span className="inline-flex max-w-[14rem] flex-col justify-center gap-0.5 align-middle">
      {clickable ? (
        <button
          type="button"
          className="break-all text-left font-mono leading-snug text-primary underline-offset-2 hover:underline"
          title="เปิดรายละเอียดใบรับ (PIMAS/PIDET)"
          onClick={(e) => {
            e.stopPropagation();
            opts.onOpenPi?.();
          }}
        >
          {value}
        </button>
      ) : (
        <span className="break-all font-mono leading-snug">{value}</span>
      )}
      {showNote ? (
        <span className="whitespace-normal font-sans text-xs leading-snug text-muted-foreground">
          (ไม่พบลิงก์ PIMAS)
        </span>
      ) : null}
    </span>
  );
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
  const [detailKind, setDetailKind] = useState<DetailKind>("po");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [poLines, setPoLines] = useState<PoLineRow[]>([]);
  const [piHeader, setPiHeader] = useState<PiHeader | null>(null);
  const [piLines, setPiLines] = useState<PiLineRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const showDates = status !== "to_be_ordered";
  const isBcodeQty =
    status === "pending_receive" ||
    status === "partially_received" ||
    status === "complete";

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

  async function openPoDetail(row: PoPendingReceiveRow) {
    if (!row.docno) return;
    setDetailKind("po");
    setDetailKey(row.docno);
    setDetailOpen(true);
    setPoLines([]);
    setPiHeader(null);
    setPiLines([]);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const path =
        site === "SYP"
          ? `/api/po/syp/${encodeURIComponent(row.docno)}`
          : `/api/po/hq/${encodeURIComponent(row.docno)}`;
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { lines: PoLineRow[] };
      setPoLines(data.lines ?? []);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }

  async function openPiDetail(row: PoPendingReceiveRow) {
    if (!canOpenPiDetail(site, row)) return;
    const key = rcvdnoValue(row);
    setDetailKind("pi");
    setDetailKey(key);
    setDetailOpen(true);
    setPoLines([]);
    setPiHeader(null);
    setPiLines([]);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/po/pi/${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        header: PiHeader;
        lines: PiLineRow[];
      };
      setPiHeader(data.header);
      setPiLines(data.lines ?? []);
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

    const statusCol: Column<PoPendingReceiveRow> = {
      key: "status",
      header: "สถานะ",
      className: "whitespace-nowrap",
      render: (r) => (
        <Badge variant={statusBadgeVariant(r.status)}>
          {statusLabel(r.status)}
        </Badge>
      ),
    };
    const docnoCol: Column<PoPendingReceiveRow> = {
      key: "docno",
      header: "DOCNO",
      className: "whitespace-nowrap",
      render: (r) =>
        r.docno ? (
          <button
            type="button"
            className="font-medium text-left text-primary underline-offset-2 hover:underline"
            title={`เปิดรายละเอียด PO (POMAS/PODET · ${site})`}
            onClick={(e) => {
              e.stopPropagation();
              void openPoDetail(r);
            }}
          >
            {r.docno}
          </button>
        ) : (
          <span className="font-medium">—</span>
        ),
    };
    const docdateCol: Column<PoPendingReceiveRow> = {
      key: "docdate",
      header: "วันที่",
      className: "whitespace-nowrap",
      render: (r) => formatPoDate(r.docdate),
    };
    const midCols: Column<PoPendingReceiveRow>[] = [
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
        statusCol,
        docnoCol,
        docdateCol,
        ...midCols,
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
          className: "min-w-[8rem] align-middle",
          render: (r) =>
            formatRcvdnoCell(r.billno ?? r.rcvdno, {
              site,
              pimasLinkMissing: r.pimas_link_missing,
              onOpenPi: () => void openPiDetail(r),
            }),
        },
      ];
    }

    return [
      statusCol,
      docnoCol,
      docdateCol,
      ...midCols,
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
    // openPoDetail / openPiDetail are stable enough for column render closures
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBcodeQty, site]);

  function renderMobileCard(row: PoPendingReceiveRow) {
    return (
      <div className="w-full rounded-md border bg-white p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          {row.docno ? (
            <button
              type="button"
              className="font-medium break-all text-left text-primary underline-offset-2 hover:underline"
              onClick={() => void openPoDetail(row)}
            >
              {row.docno}
            </button>
          ) : (
            <div className="font-medium break-all">—</div>
          )}
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
                <div>
                  {formatRcvdnoCell(row.billno || row.rcvdno, {
                    site,
                    pimasLinkMissing: row.pimas_link_missing,
                    onOpenPi: () => void openPiDetail(row),
                  })}
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
            ? "เกรน DOCNO+BCODE — สั่งจาก ICLOW; รับจาก PIDET ผ่าน RCVDNO (ไม่ใช้ PIMAS.PO). คลิก DOCNO → POMAS/PODET · คลิก RCVDNO → PIMAS/PIDET"
            : "เกรน DOCNO+BCODE — สั่ง/รับจาก ICLOW (ไม่มี PIDET ที่ SYP). คลิก DOCNO → POMAS/PODET"
          : "แยกจากรายการ PO (POMAS/PODET) — ข้อมูลจาก ICLOW อย่างเดียว. คลิก DOCNO → POMAS/PODET"}
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
        mobileCardRender={renderMobileCard}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailKind === "pi"
                ? `ใบรับ ${detailKey ?? ""}`
                : `${site} PO ${detailKey ?? ""}`}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : null}
          {detailError ? (
            <p className="text-sm text-destructive">{detailError}</p>
          ) : null}

          {detailKind === "po" && !detailLoading && !detailError ? (
            <ScrollArea className="max-h-[60vh] rounded-md border">
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
                  {poLines.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={6}>
                        ไม่มีรายการ
                      </td>
                    </tr>
                  ) : (
                    poLines.map((line, i) => (
                      <tr key={`${line.line}-${i}`} className="border-b">
                        <td className="p-2">{line.line ?? "—"}</td>
                        <td className="p-2 font-mono">{line.bcode ?? "—"}</td>
                        <td className="p-2">{line.detail ?? "—"}</td>
                        <td className="p-2 whitespace-nowrap">
                          {line.qty ?? "—"}
                          {line.ui ? ` ${line.ui}` : ""}
                        </td>
                        <td className="p-2">{formatPoAmount(line.price)}</td>
                        <td className="p-2">{formatPoAmount(line.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          ) : null}

          {detailKind === "pi" && piHeader && !detailLoading && !detailError ? (
            <div className="space-y-3">
              <div className="space-y-1 text-sm">
                <div>
                  ผู้ขาย: {piHeader.acctname ?? "—"} ({piHeader.acctno ?? "—"})
                </div>
                <div>
                  วันที่: {formatPoDate(piHeader.billdate)} · BILLNO:{" "}
                  <span className="font-mono">{piHeader.billno}</span>
                </div>
                <div>ยอด: {formatPoAmount(piHeader.aftertax)}</div>
                {piHeader.po ? (
                  <div>
                    PO (ในใบรับ):{" "}
                    <span className="font-mono">{piHeader.po}</span>
                  </div>
                ) : null}
                {piHeader.matched_rcvdno ? (
                  <div className="text-xs text-muted-foreground">
                    จับคู่แบบ left(BILLNO,12) จาก RCVDNO{" "}
                    <span className="font-mono">{piHeader.matched_rcvdno}</span>
                  </div>
                ) : null}
                {piHeader.remarks ? (
                  <div>หมายเหตุ: {piHeader.remarks}</div>
                ) : null}
              </div>
              <ScrollArea className="max-h-[50vh] rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-2">BCODE</th>
                      <th className="p-2">รายละเอียด</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2">ราคา</th>
                      <th className="p-2">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piLines.length === 0 ? (
                      <tr>
                        <td className="p-2" colSpan={5}>
                          ไม่มีรายการ
                        </td>
                      </tr>
                    ) : (
                      piLines.map((line, i) => (
                        <tr key={`${line.bcode}-${i}`} className="border-b">
                          <td className="p-2 font-mono">{line.bcode ?? "—"}</td>
                          <td className="p-2">{line.detail ?? "—"}</td>
                          <td className="p-2 whitespace-nowrap">
                            {line.qty ?? "—"}
                            {line.ui ? ` ${line.ui}` : ""}
                          </td>
                          <td className="p-2">{formatPoAmount(line.price)}</td>
                          <td className="p-2">{formatPoAmount(line.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollArea>
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
