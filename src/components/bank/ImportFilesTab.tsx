"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { StatementImportFileRow, StatementLineRow } from "@/components/bank/types";

function formatTs(value: string | null | undefined) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("th-TH");
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "done" || status === "processed") return "secondary";
  if (status === "error" || status === "failed") return "destructive";
  return "outline";
}

export default function ImportFilesTab({ refreshToken }: { refreshToken: number }) {
  const [rows, setRows] = useState<StatementImportFileRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("all");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StatementImportFileRow | null>(null);
  const [previewLines, setPreviewLines] = useState<StatementLineRow[]>([]);

  async function fetchRows(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (bankName.trim()) params.set("bank_name", bankName.trim());
      if (accountNo.trim()) params.set("account_no", accountNo.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const res = await fetch(`/api/bank/import-files?${params.toString()}`, {
        cache: "no-store",
        signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as {
        rows: StatementImportFileRow[];
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

  useEffect(() => {
    const controller = new AbortController();
    fetchRows(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, status, bankName, accountNo, from, to, limit, offset]);

  async function openDetail(row: StatementImportFileRow) {
    setSelected(row);
    setOpen(true);
    setPreviewLines([]);
    try {
      const res = await fetch(`/api/bank/import-files/${row.id}/lines?limit=30`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { rows: StatementLineRow[] };
      setPreviewLines(data.rows ?? []);
    } catch {
      // ignore
    }
  }

  const columns: Column<StatementImportFileRow>[] = useMemo(
    () => [
      {
        key: "last_seen_at",
        header: "last_seen_at",
        className: "whitespace-nowrap",
        render: (r) => formatTs(r.last_seen_at),
      },
      {
        key: "bank_name",
        header: "bank_name",
        className: "whitespace-nowrap",
        render: (r) => r.bank_name ?? "",
      },
      {
        key: "account_no",
        header: "account_no",
        className: "whitespace-nowrap",
        render: (r) => r.account_no ?? "",
      },
      {
        key: "original_filename",
        header: "original_filename",
        className: "min-w-[12rem] max-w-[20rem]",
        render: (r) => (
          <span className="line-clamp-2 break-all">{r.original_filename}</span>
        ),
      },
      {
        key: "status",
        header: "status",
        className: "whitespace-nowrap min-w-[6rem]",
        render: (r) => (
          <Badge
            variant={statusBadgeVariant(r.status)}
            className="whitespace-nowrap shrink-0"
            title={r.status}
          >
            {r.status}
          </Badge>
        ),
      },
      {
        key: "row_count",
        header: "row_count",
        className: "text-right whitespace-nowrap",
        render: (r) => r.row_count,
      },
      {
        key: "inserted_count",
        header: "inserted_count",
        className: "text-right whitespace-nowrap hidden lg:table-cell",
        render: (r) => r.inserted_count,
      },
      {
        key: "duplicate_count",
        header: "duplicate_count",
        className: "text-right whitespace-nowrap hidden lg:table-cell",
        render: (r) => r.duplicate_count,
      },
      {
        key: "error_count",
        header: "error_count",
        className: "text-right whitespace-nowrap hidden xl:table-cell",
        render: (r) => r.error_count,
      },
      {
        key: "error_message",
        header: "error_message",
        className: "min-w-[12rem] max-w-[18rem] hidden xl:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">
            {r.error_message ?? ""}
          </span>
        ),
      },
    ],
    []
  );

  function renderImportMobileCard(row: StatementImportFileRow) {
    return (
      <button
        type="button"
        onClick={() => void openDetail(row)}
        className="w-full rounded-md border bg-white p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
      >
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant={statusBadgeVariant(row.status)}
            className="whitespace-nowrap shrink-0"
            title={row.status}
          >
            {row.status}
          </Badge>
          <div className="text-right text-xs text-muted-foreground leading-snug whitespace-nowrap">
            {formatTs(row.last_seen_at)}
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <div>
            <div className="text-xs text-muted-foreground">filename</div>
            <div className="text-sm font-medium break-all">
              {row.original_filename}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">bank</div>
              <div className="text-sm break-all">{row.bank_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">account</div>
              <div className="text-sm font-mono break-all">
                {row.account_no || "—"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">rows</div>
              <div className="font-medium">{row.row_count}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">inserted</div>
              <div className="font-medium">{row.inserted_count}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">dupes</div>
              <div className="font-medium">{row.duplicate_count}</div>
            </div>
          </div>
          {row.error_message ? (
            <div>
              <div className="text-xs text-muted-foreground">error</div>
              <div className="text-sm text-destructive line-clamp-2 break-words">
                {row.error_message}
              </div>
            </div>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-3 sm:p-4 bg-slate-50 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-end">
          <div>
            <div className="text-xs text-muted-foreground mb-1">status</div>
            <Select
              value={status}
              onValueChange={(v) => {
                setOffset(0);
                setStatus(v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="processing">processing</SelectItem>
                <SelectItem value="done">done</SelectItem>
                <SelectItem value="error">error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">bank_name</div>
            <Input
              value={bankName}
              onChange={(e) => {
                setOffset(0);
                setBankName(e.target.value);
              }}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">account_no</div>
            <Input
              value={accountNo}
              onChange={(e) => {
                setOffset(0);
                setAccountNo(e.target.value);
              }}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              last_seen_at from
            </div>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setOffset(0);
                setFrom(e.target.value);
              }}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              last_seen_at to
            </div>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setOffset(0);
                setTo(e.target.value);
              }}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => {
              setOffset(0);
              setStatus("all");
              setBankName("");
              setAccountNo("");
              setFrom("");
              setTo("");
            }}
          >
            ล้างตัวกรอง
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => fetchRows()}
          >
            ค้นหา
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <ServerPagedTable
        columns={columns}
        rows={rows}
        count={count}
        limit={limit}
        offset={offset}
        onLimitChange={setLimit}
        onOffsetChange={setOffset}
        onRowClick={openDetail}
        loading={loading}
        tableMinWidthClassName="min-w-[52rem]"
        rowKey={(row) => row.id}
        mobileCardRender={renderImportMobileCard}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import File Detail</DialogTitle>
            <DialogDescription>
              {selected ? selected.original_filename : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border">
              <div className="p-3 border-b font-medium">raw_metadata</div>
              <ScrollArea className="h-[280px] sm:h-[420px]">
                <pre className="text-xs p-3 whitespace-pre-wrap">
                  {prettyJson(selected?.raw_metadata)}
                </pre>
              </ScrollArea>
            </div>
            <div className="rounded-md border">
              <div className="p-3 border-b font-medium">
                Preview lines (first 30)
              </div>
              <ScrollArea className="h-[280px] sm:h-[420px]">
                <div className="p-3 text-xs flex flex-col gap-2">
                  {previewLines.length === 0 ? (
                    <div className="text-muted-foreground">ไม่มีข้อมูล</div>
                  ) : (
                    previewLines.map((l) => (
                      <div key={l.id} className="border rounded p-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2">
                          <div className="font-medium">
                            {l.txn_date} • {l.direction} •{" "}
                            {Number(l.amount).toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-muted-foreground whitespace-nowrap">
                            row {l.source_row_number ?? "-"} /{" "}
                            {l.source_sheet_name ?? "-"}
                          </div>
                        </div>
                        <div className="mt-1 break-words">
                          {l.description ?? ""}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                          <span>match: {l.match_status}</span>
                          {l.match_reason ? (
                            <span>• {l.match_reason}</span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

