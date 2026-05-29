"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
import { Input } from "@/components/ui/input";

import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import type { StatementLineRow } from "@/components/bank/types";

type BankAccountOption = {
  account_no: string;
  bank_name: string | null;
};

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusBadgeVariant(status: string): BadgeProps["variant"] {
  if (status === "matched") return "secondary";
  return "outline";
}

function currentMonthValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthToRange(month: string): { from: string; to: string } | null {
  if (!month) return null;
  const [y, m] = month.split("-").map((x) => Number(x));
  if (!y || !m) return null;
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: fmt(from), to: fmt(to) };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
}

function accountLabel(a: BankAccountOption) {
  return a.bank_name ? `${a.account_no} (${a.bank_name})` : a.account_no;
}

export default function StatementLinesTab({
  refreshToken,
}: {
  refreshToken: number;
}) {
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [accountNo, setAccountNo] = useState("");
  const [month, setMonth] = useState(currentMonthValue);

  const [direction, setDirection] = useState<string>("all");
  const [matchStatus, setMatchStatus] = useState<string>("all");

  const [rows, setRows] = useState<StatementLineRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StatementLineRow | null>(null);
  const [selectedRawJson, setSelectedRawJson] = useState<unknown>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.account_no === accountNo) ?? null,
    [accounts, accountNo]
  );

  const canFetch = Boolean(accountNo && month);

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await fetch("/api/bank/statement-lines/accounts", {
        cache: "no-store",
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { accounts: BankAccountOption[] };
      const list = data.accounts ?? [];
      setAccounts(list);
      setAccountNo((prev) => {
        if (prev && list.some((a) => a.account_no === prev)) return prev;
        return list[0]?.account_no ?? "";
      });
    } catch (e) {
      if (String(e).includes("AbortError")) return;
      setAccountsError(e instanceof Error ? e.message : String(e));
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAccounts(controller.signal);
    return () => controller.abort();
  }, [loadAccounts, refreshToken]);

  const fetchRows = useCallback(
    async (signal?: AbortSignal) => {
      if (!canFetch) {
        setRows([]);
        setCount(null);
        return;
      }

      const range = monthToRange(month);
      if (!range) return;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("account_no", accountNo);
        params.set("from", range.from);
        params.set("to", range.to);
        if (direction !== "all") params.set("direction", direction);
        if (matchStatus !== "all") params.set("match_status", matchStatus);
        params.set("limit", String(limit));
        params.set("offset", String(offset));

        const res = await fetch(
          `/api/bank/statement-lines?${params.toString()}`,
          { cache: "no-store", signal }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as {
          rows: StatementLineRow[];
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
    },
    [accountNo, month, direction, matchStatus, limit, offset, canFetch]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchRows(controller.signal);
    return () => controller.abort();
  }, [fetchRows, refreshToken]);

  async function openRaw(row: StatementLineRow) {
    setSelected(row);
    setSelectedRawJson(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/bank/statement-lines/${row.id}`, {
        cache: "no-store",
      });
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
      {
        key: "description",
        header: "description",
        render: (r) => r.description ?? "",
      },
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
      {
        key: "bank_reference",
        header: "bank_reference",
        render: (r) => r.bank_reference ?? "",
      },
      {
        key: "match_status",
        header: "match_status",
        render: (r) => (
          <Badge variant={statusBadgeVariant(r.match_status)}>
            {r.match_status}
          </Badge>
        ),
      },
      {
        key: "source_sheet_name",
        header: "source_sheet_name",
        render: (r) => r.source_sheet_name ?? "",
      },
      {
        key: "source_row_number",
        header: "source_row_number",
        className: "text-right",
        render: (r) => r.source_row_number ?? "",
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-4 bg-slate-50 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[280px] flex-1">
            <div className="text-xs text-muted-foreground mb-1">บัญชี</div>
            <Select
              value={accountNo || undefined}
              onValueChange={(v) => {
                setOffset(0);
                setAccountNo(v);
              }}
              disabled={accountsLoading || accounts.length === 0}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue
                  placeholder={
                    accountsLoading ? "กำลังโหลดบัญชี..." : "เลือกบัญชี"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.account_no} value={a.account_no}>
                    {accountLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">เดือน</div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  setOffset(0);
                  setMonth((m) => shiftMonth(m, -1));
                }}
                disabled={!month}
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="month"
                value={month}
                onChange={(e) => {
                  setOffset(0);
                  setMonth(e.target.value);
                }}
                className="w-[160px]"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  setOffset(0);
                  setMonth((m) => shiftMonth(m, 1));
                }}
                disabled={!month}
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {selectedAccount && month && (
          <p className="text-sm text-muted-foreground">
            แสดงรายการของ{" "}
            <span className="font-medium text-foreground">
              {accountLabel(selectedAccount)}
            </span>{" "}
            ในเดือน{" "}
            <span className="font-medium text-foreground">
              {formatMonthLabel(month)}
            </span>
            {count !== null && (
              <>
                {" "}
                — ทั้งหมด {count.toLocaleString("th-TH")} รายการ
              </>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-slate-200">
          <div className="min-w-[140px]">
            <div className="text-xs text-muted-foreground mb-1">direction</div>
            <Select
              value={direction}
              onValueChange={(v) => {
                setOffset(0);
                setDirection(v);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="in">in</SelectItem>
                <SelectItem value="out">out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <div className="text-xs text-muted-foreground mb-1">
              match_status
            </div>
            <Select
              value={matchStatus}
              onValueChange={(v) => {
                setOffset(0);
                setMatchStatus(v);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="unmatched">unmatched</SelectItem>
                <SelectItem value="matched">matched</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {accountsError && (
        <div className="text-sm text-red-600">{accountsError}</div>
      )}
      {!accountsLoading && accounts.length === 0 && !accountsError && (
        <div className="text-sm text-muted-foreground">
          ยังไม่มีบัญชีใน statement_lines
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && (
        <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
      )}

      {canFetch && (
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Statement Line raw_json</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.txn_date} • ${selected.description ?? ""}` : ""}
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
