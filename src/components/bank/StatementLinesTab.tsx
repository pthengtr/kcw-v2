"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME,
  bankMatchAccountsLabel,
  isBankMatchAccount,
} from "@/lib/bank/match-prompt-constants";

type BankAccountOption = {
  account_no: string;
  bank_name: string | null;
};

type ActiveMatchJob = {
  agentId: string;
  runId: string;
  agentUrl: string;
  accountNo: string;
  from: string;
  to: string;
};

const MATCH_JOB_STORAGE_KEY = "bank.match.activeJob.v1";

function isTerminalMatchStatus(status: string) {
  return ["FINISHED", "ERROR", "CANCELLED", "EXPIRED"].includes(
    status.toUpperCase()
  );
}

function matchRunStatusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "CREATING":
      return "กำลังสร้าง agent…";
    case "RUNNING":
      return "agent กำลังจับคู่…";
    case "FINISHED":
      return "จับคู่เสร็จแล้ว";
    case "ERROR":
      return "agent ล้มเหลว";
    case "CANCELLED":
      return "ยกเลิกงานแล้ว";
    case "EXPIRED":
      return "งานหมดอายุ";
    default:
      return `สถานะ: ${status}`;
  }
}

function readStoredMatchJob(): ActiveMatchJob | null {
  try {
    const raw = sessionStorage.getItem(MATCH_JOB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveMatchJob;
    if (!parsed?.agentId || !parsed?.runId || !parsed?.agentUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredMatchJob(job: ActiveMatchJob | null) {
  try {
    if (!job) sessionStorage.removeItem(MATCH_JOB_STORAGE_KEY);
    else sessionStorage.setItem(MATCH_JOB_STORAGE_KEY, JSON.stringify(job));
  } catch {
    // ignore
  }
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function matchStatusLabel(status: string) {
  switch (status) {
    case "matched":
      return "จับคู่แล้ว";
    case "review":
      return "ต้องตรวจ";
    case "ignored":
      return "ไม่ใช้";
    case "unmatched":
      return "ยังไม่จับคู่";
    default:
      return status;
  }
}

function MatchStatusBadge({ status }: { status: string }) {
  const label = matchStatusLabel(status);
  if (status === "matched") {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        {label}
      </Badge>
    );
  }
  if (status === "review") {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100">
        {label}
      </Badge>
    );
  }
  if (status === "ignored") {
    return (
      <Badge className="border-transparent bg-slate-200 text-slate-700 hover:bg-slate-200">
        {label}
      </Badge>
    );
  }
  return <Badge variant="outline">{label}</Badge>;
}

function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  return Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatMatchedRef(row: StatementLineRow) {
  if (!row.matched_ref_type && !row.matched_ref_id) return "";
  if (row.matched_ref_type && row.matched_ref_id) {
    return `${row.matched_ref_type}:${row.matched_ref_id}`;
  }
  return row.matched_ref_type ?? row.matched_ref_id ?? "";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StatementLineRow | null>(null);
  const [selectedRawJson, setSelectedRawJson] = useState<unknown>(null);

  const [matching, setMatching] = useState(false);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [matchAgentUrl, setMatchAgentUrl] = useState<string | null>(null);
  const [matchRunStatus, setMatchRunStatus] = useState<string | null>(null);
  const [activeMatchJob, setActiveMatchJob] = useState<ActiveMatchJob | null>(
    null
  );
  const [reloadToken, setReloadToken] = useState(0);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.account_no === accountNo) ?? null,
    [accounts, accountNo]
  );

  const canFetch = Boolean(accountNo && month);
  const matchRunning =
    matching ||
    (!!matchRunStatus && !isTerminalMatchStatus(matchRunStatus));
  const canMatch =
    canFetch && isBankMatchAccount(accountNo) && !matchRunning;

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
        const preferred = list.find(
          (a) => a.account_no === BANK_MATCH_ACCOUNT_NO
        );
        return preferred?.account_no ?? list[0]?.account_no ?? "";
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
  }, [fetchRows, refreshToken, reloadToken]);

  useEffect(() => {
    const stored = readStoredMatchJob();
    if (!stored) return;
    setActiveMatchJob(stored);
    setMatchAgentUrl(stored.agentUrl);
    setMatchRunStatus("RUNNING");
    setMatchMessage(matchRunStatusLabel("RUNNING"));
  }, []);

  useEffect(() => {
    if (!activeMatchJob) return;

    let cancelled = false;

    const pollOnce = async () => {
      try {
        const params = new URLSearchParams({
          agentId: activeMatchJob.agentId,
          runId: activeMatchJob.runId,
        });
        const res = await fetch(`/api/bank/match/status?${params.toString()}`, {
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setMatchMessage(
            body?.error ??
              body?.details ??
              `เช็คสถานะไม่สำเร็จ (${res.status})`
          );
          return;
        }

        const status = String(body?.run?.status ?? "RUNNING");
        setMatchRunStatus(status);
        setMatchMessage(matchRunStatusLabel(status));
        if (body?.agentUrl) setMatchAgentUrl(String(body.agentUrl));

          if (body?.terminal || isTerminalMatchStatus(status)) {
          writeStoredMatchJob(null);
          setActiveMatchJob(null);
          setMatching(false);
          if (status.toUpperCase() === "FINISHED") {
            setMatchMessage("จับคู่เสร็จแล้ว — รีเฟรชรายการแล้ว");
            setReloadToken((n) => n + 1);
          }
        }
      } catch (e) {
        if (cancelled) return;
        setMatchMessage(e instanceof Error ? e.message : String(e));
      }
    };

    void pollOnce();
    const timer = setInterval(() => {
      void pollOnce();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeMatchJob]);

  async function openRaw(row: StatementLineRow) {
    setSelected(row);
    setSelectedRawJson(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/bank/statement-lines/${row.id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        row?: StatementLineRow & { raw_json?: unknown };
      };
      if (data?.row) {
        setSelected({
          ...row,
          match_status: data.row.match_status ?? row.match_status,
          match_reason: data.row.match_reason ?? null,
          match_confidence: data.row.match_confidence ?? null,
          matched_ref_type: data.row.matched_ref_type ?? null,
          matched_ref_id: data.row.matched_ref_id ?? null,
          match_notes: data.row.match_notes ?? null,
          matched_at: data.row.matched_at ?? null,
          matched_by: data.row.matched_by ?? null,
        });
        setSelectedRawJson(data.row.raw_json ?? null);
      }
    } catch {
      // ignore
    }
  }

  async function handleMatch() {
    const range = monthToRange(month);
    if (!range || !isBankMatchAccount(accountNo)) return;

    setMatching(true);
    setMatchMessage("กำลังเริ่ม agent…");
    setMatchAgentUrl(null);
    setMatchRunStatus("CREATING");
    try {
      const res = await fetch("/api/bank/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_no: accountNo,
          from: range.from,
          to: range.to,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = String(body?.error ?? `Match failed (${res.status})`);
        const details = body?.details ? String(body.details) : "";
        throw new Error(details ? `${err} — ${details}` : err);
      }

      const agent = body?.agent as
        | {
            agentId?: string;
            runId?: string;
            agentUrl?: string;
            status?: string;
          }
        | undefined;

      if (!agent?.agentId || !agent?.runId || !agent?.agentUrl) {
        throw new Error("API ไม่ส่ง agentId/runId กลับมา");
      }

      const status = String(agent.status ?? "CREATING");
      const job: ActiveMatchJob = {
        agentId: agent.agentId,
        runId: agent.runId,
        agentUrl: agent.agentUrl,
        accountNo,
        from: range.from,
        to: range.to,
      };

      writeStoredMatchJob(job);
      setMatchAgentUrl(agent.agentUrl);
      setMatchRunStatus(status);
      setMatchMessage(matchRunStatusLabel(status));
      setActiveMatchJob(job);
    } catch (e) {
      setMatchMessage(e instanceof Error ? e.message : String(e));
      setMatchRunStatus(null);
      setMatching(false);
    } finally {
      setMatching(false);
    }
  }

  const columns: Column<StatementLineRow>[] = useMemo(
    () => [
      { key: "txn_date", header: "วันที่", render: (r) => r.txn_date },
      {
        key: "description",
        header: "รายละเอียด",
        render: (r) => r.description ?? "",
      },
      {
        key: "amount",
        header: "จำนวนเงิน",
        className: "text-right",
        render: (r) =>
          Number(r.amount).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
      {
        key: "direction",
        header: "ทิศทาง",
        render: (r) =>
          r.direction === "in"
            ? "เข้า"
            : r.direction === "out"
              ? "ออก"
              : r.direction,
      },
      {
        key: "balance_after",
        header: "ยอดคงเหลือ",
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
        header: "อ้างอิงธนาคาร",
        render: (r) => r.bank_reference ?? "",
      },
      {
        key: "match_status",
        header: "สถานะจับคู่",
        render: (r) => <MatchStatusBadge status={r.match_status} />,
      },
      {
        key: "match_reason",
        header: "เหตุผล",
        render: (r) => r.match_reason ?? "",
      },
      {
        key: "match_confidence",
        header: "ความมั่นใจ",
        className: "text-right",
        render: (r) => formatConfidence(r.match_confidence),
      },
      {
        key: "match_notes",
        header: "หมายเหตุ",
        render: (r) => r.match_notes ?? "",
      },
      {
        key: "source_sheet_name",
        header: "ชีทต้นทาง",
        render: (r) => r.source_sheet_name ?? "",
      },
      {
        key: "source_row_number",
        header: "แถวต้นทาง",
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
          <div className="min-w-0 flex-1 basis-full sm:min-w-[280px] sm:basis-auto">
            <div className="text-xs text-muted-foreground mb-1">บัญชี</div>
            <Select
              value={accountNo || undefined}
              onValueChange={(v) => {
                setOffset(0);
                setAccountNo(v);
                setMatchMessage(null);
                setMatchAgentUrl(null);
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

          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">จับคู่อัตโนมัติ</div>
            <Button
              type="button"
              onClick={handleMatch}
              disabled={!canMatch}
              title={
                matchRunning
                  ? "agent กำลังจับคู่ — รอให้เสร็จก่อน"
                  : accountNo && !isBankMatchAccount(accountNo)
                    ? `ตอนนี้รองรับเฉพาะบัญชี ${bankMatchAccountsLabel()}`
                    : `${BANK_MATCH_AGENT_NAME} — จับคู่ตามกฎใน prompts/`
              }
            >
              {matchRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {matchRunning ? "agent กำลังจับคู่…" : BANK_MATCH_AGENT_NAME}
            </Button>
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

        {accountNo && !isBankMatchAccount(accountNo) ? (
          <p className="text-sm text-amber-800">
            {BANK_MATCH_AGENT_NAME} ใช้ได้เฉพาะบัญชี {bankMatchAccountsLabel()}
          </p>
        ) : null}
        {matchRunning || matchMessage ? (
          <p
            className={
              matchRunning
                ? "text-sm text-sky-800 flex flex-wrap items-center gap-x-1 gap-y-1"
                : "text-sm text-muted-foreground"
            }
            role="status"
            aria-live="polite"
          >
            {matchRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : null}
            <span>
              {matchMessage ?? matchRunStatusLabel(matchRunStatus ?? "RUNNING")}
            </span>
            {matchAgentUrl ? (
              <>
                {" "}
                —{" "}
                <a
                  href={matchAgentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  เปิดดูงาน agent
                </a>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-slate-200">
          <div className="min-w-0 flex-1 sm:min-w-[140px] sm:flex-none">
            <div className="text-xs text-muted-foreground mb-1">ทิศทาง</div>
            <Select
              value={direction}
              onValueChange={(v) => {
                setOffset(0);
                setDirection(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="in">เข้า</SelectItem>
                <SelectItem value="out">ออก</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 flex-1 sm:min-w-[180px] sm:flex-none">
            <div className="text-xs text-muted-foreground mb-1">สถานะจับคู่</div>
            <Select
              value={matchStatus}
              onValueChange={(v) => {
                setOffset(0);
                setMatchStatus(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="review">ต้องตรวจ</SelectItem>
                <SelectItem value="unmatched">ยังไม่จับคู่</SelectItem>
                <SelectItem value="matched">จับคู่แล้ว</SelectItem>
                <SelectItem value="ignored">ไม่ใช้</SelectItem>
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
          loading={loading}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>รายละเอียดรายการเดินบัญชี</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.txn_date} • ${selected.description ?? ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">สถานะจับคู่</div>
                <MatchStatusBadge status={selected.match_status} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">ความมั่นใจ</div>
                <div>{formatConfidence(selected.match_confidence) || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">เหตุผล</div>
                <div>{selected.match_reason || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">อ้างอิงที่จับคู่</div>
                <div>{formatMatchedRef(selected) || "-"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-muted-foreground">หมายเหตุ</div>
                <div className="whitespace-pre-wrap">
                  {selected.match_notes || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">จับคู่โดย</div>
                <div>{selected.matched_by || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">เวลาจับคู่</div>
                <div>{selected.matched_at || "-"}</div>
              </div>
            </div>
          )}
          <div className="rounded-md border">
            <ScrollArea className="h-[420px]">
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
