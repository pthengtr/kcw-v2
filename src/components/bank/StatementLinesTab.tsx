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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import type { StatementLineRow } from "@/components/bank/types";

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "matched") return "secondary";
  if (status === "unmatched") return "outline";
  return "outline";
}

function monthToRange(month: string): { from: string; to: string } | null {
  // month input: YYYY-MM
  if (!month) return null;
  const [y, m] = month.split("-").map((x) => Number(x));
  if (!y || !m) return null;
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

export default function StatementLinesTab({ refreshToken }: { refreshToken: number }) {
  const [rows, setRows] = useState<StatementLineRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountNo, setAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [direction, setDirection] = useState<string>("all");
  const [matchStatus, setMatchStatus] = useState<string>("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  const [dateMode, setDateMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StatementLineRow | null>(null);
  const [selectedRawJson, setSelectedRawJson] = useState<unknown>(null);

  async function fetchRows(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountNo.trim()) params.set("account_no", accountNo.trim());
      if (bankName.trim()) params.set("bank_name", bankName.trim());
      if (direction !== "all") params.set("direction", direction);
      if (matchStatus !== "all") params.set("match_status", matchStatus);

      const amountMinN = amountMin.trim() ? Number(amountMin) : null;
      const amountMaxN = amountMax.trim() ? Number(amountMax) : null;
      if (typeof amountMinN === "number" && Number.isFinite(amountMinN)) {
        params.set("amount_min", String(amountMinN));
      }
      if (typeof amountMaxN === "number" && Number.isFinite(amountMaxN)) {
        params.set("amount_max", String(amountMaxN));
      }

      if (dateMode === "month") {
        const range = monthToRange(month);
        if (range) {
          params.set("from", range.from);
          params.set("to", range.to);
        }
      } else {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }

      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const res = await fetch(`/api/bank/statement-lines?${params.toString()}`, {
        cache: "no-store",
        signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { rows: StatementLineRow[]; count: number | null };
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
  }, [
    refreshToken,
    accountNo,
    bankName,
    direction,
    matchStatus,
    amountMin,
    amountMax,
    dateMode,
    month,
    from,
    to,
    limit,
    offset,
  ]);

  async function openRaw(row: StatementLineRow) {
    setSelected(row);
    setSelectedRawJson(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/bank/statement-lines/${row.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { row: { raw_json?: unknown } };
      setSelectedRawJson(data?.row?.raw_json ?? null);
    } catch {
      // ignore
    }
  }

  const columns: Column<StatementLineRow>[] = useMemo(
    () => [
      { key: "txn_date", header: "txn_date", render: (r) => r.txn_date },
      { key: "description", header: "description", render: (r) => r.description ?? "" },
      {
        key: "amount",
        header: "amount",
        className: "text-right",
        render: (r) =>
          Number(r.amount).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
      { key: "direction", header: "direction", render: (r) => r.direction },
      {
        key: "balance_after",
        header: "balance_after",
        className: "text-right",
        render: (r) =>
          r.balance_after === null
            ? ""
            : Number(r.balance_after).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
      },
      { key: "bank_reference", header: "bank_reference", render: (r) => r.bank_reference ?? "" },
      { key: "account_no", header: "account_no", render: (r) => r.account_no },
      { key: "bank_name", header: "bank_name", render: (r) => r.bank_name ?? "" },
      {
        key: "match_status",
        header: "match_status",
        render: (r) => (
          <Badge variant={statusBadgeVariant(r.match_status)}>{r.match_status}</Badge>
        ),
      },
      { key: "source_sheet_name", header: "source_sheet_name", render: (r) => r.source_sheet_name ?? "" },
      { key: "source_row_number", header: "source_row_number", className: "text-right", render: (r) => r.source_row_number ?? "" },
      { key: "source_file_id", header: "source_file_id", render: (r) => r.source_file_id ?? "" },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-4 bg-slate-50 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">account_no</div>
          <Input value={accountNo} onChange={(e) => { setOffset(0); setAccountNo(e.target.value); }} className="w-[220px]" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">bank_name</div>
          <Input value={bankName} onChange={(e) => { setOffset(0); setBankName(e.target.value); }} className="w-[220px]" />
        </div>
        <div className="min-w-[160px]">
          <div className="text-xs text-muted-foreground mb-1">direction</div>
          <Select value={direction} onValueChange={(v) => { setOffset(0); setDirection(v); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="in">in</SelectItem>
              <SelectItem value="out">out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <div className="text-xs text-muted-foreground mb-1">match_status</div>
          <Select value={matchStatus} onValueChange={(v) => { setOffset(0); setMatchStatus(v); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="unmatched">unmatched</SelectItem>
              <SelectItem value="matched">matched</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">amount_min</div>
          <Input inputMode="decimal" value={amountMin} onChange={(e) => { setOffset(0); setAmountMin(e.target.value); }} className="w-[140px]" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">amount_max</div>
          <Input inputMode="decimal" value={amountMax} onChange={(e) => { setOffset(0); setAmountMax(e.target.value); }} className="w-[140px]" />
        </div>

        <div className="w-full flex flex-wrap gap-3 items-end">
          <div className="mr-auto">
            <div className="text-xs text-muted-foreground mb-1">date filter</div>
            <Tabs
              value={dateMode}
              onValueChange={(v) => {
                setOffset(0);
                setDateMode(v === "range" ? "range" : "month");
              }}
            >
              <TabsList>
                <TabsTrigger value="month">month</TabsTrigger>
                <TabsTrigger value="range">range</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {dateMode === "month" ? (
            <div>
              <div className="text-xs text-muted-foreground mb-1">month</div>
              <Input type="month" value={month} onChange={(e) => { setOffset(0); setMonth(e.target.value); }} />
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">txn_date from</div>
                <Input type="date" value={from} onChange={(e) => { setOffset(0); setFrom(e.target.value); }} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">txn_date to</div>
                <Input type="date" value={to} onChange={(e) => { setOffset(0); setTo(e.target.value); }} />
              </div>
            </>
          )}

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOffset(0);
                setAccountNo("");
                setBankName("");
                setDirection("all");
                setMatchStatus("all");
                setAmountMin("");
                setAmountMax("");
                setDateMode("month");
                setMonth("");
                setFrom("");
                setTo("");
              }}
            >
              ล้างตัวกรอง
            </Button>
            <Button variant="outline" onClick={() => fetchRows()}>
              ค้นหา
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-muted-foreground">กำลังโหลด...</div>}

      <ServerPagedTable
        columns={columns}
        rows={rows}
        count={count}
        limit={limit}
        offset={offset}
        onLimitChange={setLimit}
        onOffsetChange={setOffset}
        onRowClick={openRaw}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Statement Line raw_json</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.txn_date} • ${selected.account_no}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border">
            <ScrollArea className="h-[520px]">
              <pre className="text-xs p-3 whitespace-pre-wrap">
                {prettyJson(selectedRawJson)}
              </pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

