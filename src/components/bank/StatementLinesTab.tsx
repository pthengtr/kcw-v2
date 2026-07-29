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
import { Textarea } from "@/components/ui/textarea";

import { ServerPagedTable, type Column } from "@/components/bank/ServerPagedTable";
import type { StatementLineRow } from "@/components/bank/types";
import {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME,
  bankMatchAccountsLabel,
  isBankMatchAccount,
} from "@/lib/bank/match-prompt-constants";
import {
  canOperatorEditMatchFields,
  canOperatorTransitionMatchStatus,
  matchStatusLabelTh,
} from "@/lib/bank/match-status";

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
  return matchStatusLabelTh(status);
}

function MatchStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = matchStatusLabel(status);
  const base =
    "whitespace-nowrap shrink-0 max-w-full inline-flex items-center";
  if (status === "matched" || status === "resolved" || status === "manual") {
    return (
      <Badge
        title={label}
        className={`${base} border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100 ${className ?? ""}`}
      >
        {label}
      </Badge>
    );
  }
  if (status === "review") {
    return (
      <Badge
        title={label}
        className={`${base} border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100 ${className ?? ""}`}
      >
        {label}
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge
        title={label}
        className={`${base} border-transparent bg-sky-100 text-sky-900 hover:bg-sky-100 ${className ?? ""}`}
      >
        {label}
      </Badge>
    );
  }
  if (status === "ignored") {
    return (
      <Badge
        title={label}
        className={`${base} border-transparent bg-slate-200 text-slate-700 hover:bg-slate-200 ${className ?? ""}`}
      >
        {label}
      </Badge>
    );
  }
  if (status === "unmatched") {
    return (
      <Badge
        title={label}
        className={`${base} border-transparent bg-rose-100 text-rose-900 hover:bg-rose-100 ${className ?? ""}`}
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge title={label} variant="outline" className={`${base} ${className ?? ""}`}>
      {label}
    </Badge>
  );
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
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRefType, setEditRefType] = useState("");
  const [editRefId, setEditRefId] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [saveMatchError, setSaveMatchError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
    setEditReason(row.match_reason ?? "");
    setEditNotes(row.match_notes ?? "");
    setEditRefType(row.matched_ref_type ?? "");
    setEditRefId(row.matched_ref_id ?? "");
    setSaveMatchError(null);
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
        const next = {
          ...row,
          match_status: data.row.match_status ?? row.match_status,
          match_reason: data.row.match_reason ?? null,
          match_confidence: data.row.match_confidence ?? null,
          matched_ref_type: data.row.matched_ref_type ?? null,
          matched_ref_id: data.row.matched_ref_id ?? null,
          match_notes: data.row.match_notes ?? null,
          matched_at: data.row.matched_at ?? null,
          matched_by: data.row.matched_by ?? null,
        };
        setSelected(next);
        setEditReason(next.match_reason ?? "");
        setEditNotes(next.match_notes ?? "");
        setEditRefType(next.matched_ref_type ?? "");
        setEditRefId(next.matched_ref_id ?? "");
        setSelectedRawJson(data.row.raw_json ?? null);
      }
    } catch {
      // ignore
    }
  }

  async function saveMatchUpdate(nextStatus?: string) {
    if (!selected) return;
    const status = nextStatus ?? selected.match_status;
    if (!canOperatorTransitionMatchStatus(selected.match_status, status)) {
      setSaveMatchError(
        `เปลี่ยนสถานะจาก ${matchStatusLabel(selected.match_status)} เป็น ${matchStatusLabel(status)} ไม่ได้`
      );
      return;
    }

    setSavingMatch(true);
    setSaveMatchError(null);
    try {
      const res = await fetch(`/api/bank/statement-lines/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_status: status,
          match_reason: editReason.trim() ? editReason.trim() : null,
          match_notes: editNotes.trim() ? editNotes.trim() : null,
          matched_ref_type: editRefType.trim() ? editRefType.trim() : null,
          matched_ref_id: editRefId.trim() ? editRefId.trim() : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body?.error ?? body?.details ?? `บันทึกไม่สำเร็จ (${res.status})`
        );
      }
      const updated = body?.row as StatementLineRow | undefined;
      if (updated) {
        setSelected(updated);
        setRows((prev) =>
          prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
        );
        setEditReason(updated.match_reason ?? "");
        setEditNotes(updated.match_notes ?? "");
        setEditRefType(updated.matched_ref_type ?? "");
        setEditRefId(updated.matched_ref_id ?? "");
      }
    } catch (e) {
      setSaveMatchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingMatch(false);
    }
  }

  async function exportCsv() {
    const range = monthToRange(month);
    if (!range || !accountNo) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("account_no", accountNo);
      params.set("from", range.from);
      params.set("to", range.to);
      if (direction !== "all") params.set("direction", direction);
      if (matchStatus !== "all") params.set("match_status", matchStatus);
      params.set("limit", "5000");
      params.set("offset", "0");

      const res = await fetch(`/api/bank/statement-lines?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      const data = (await res.json()) as { rows: StatementLineRow[] };
      const exportRows = data.rows ?? [];

      const header = [
        "txn_date",
        "description",
        "amount",
        "direction",
        "match_status",
        "match_reason",
        "match_notes",
        "match_confidence",
        "matched_ref_type",
        "matched_ref_id",
        "matched_by",
        "matched_at",
      ];
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
        return s;
      };
      const lines = [
        header.join(","),
        ...exportRows.map((r) =>
          [
            r.txn_date,
            r.description,
            r.amount,
            r.direction,
            r.match_status,
            r.match_reason,
            r.match_notes,
            r.match_confidence,
            r.matched_ref_type,
            r.matched_ref_id,
            r.matched_by,
            r.matched_at,
          ]
            .map(escape)
            .join(",")
        ),
      ];
      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${accountNo}-${month}${
        matchStatus !== "all" ? `-${matchStatus}` : ""
      }.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
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
      {
        key: "txn_date",
        header: "วันที่",
        className: "whitespace-nowrap",
        render: (r) => r.txn_date,
      },
      {
        key: "description",
        header: "รายละเอียด",
        className: "min-w-[12rem] max-w-[20rem]",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.description ?? ""}</span>
        ),
      },
      {
        key: "amount",
        header: "จำนวนเงิน",
        className: "text-right whitespace-nowrap",
        render: (r) =>
          Number(r.amount).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
      {
        key: "direction",
        header: "ทิศทาง",
        className: "whitespace-nowrap",
        render: (r) =>
          r.direction === "in"
            ? "เข้า"
            : r.direction === "out"
              ? "ออก"
              : r.direction,
      },
      {
        key: "match_status",
        header: "สถานะจับคู่",
        className: "whitespace-nowrap min-w-[8.5rem]",
        render: (r) => <MatchStatusBadge status={r.match_status} />,
      },
      {
        key: "balance_after",
        header: "ยอดคงเหลือ",
        className: "text-right whitespace-nowrap hidden xl:table-cell",
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
        className: "hidden xl:table-cell whitespace-nowrap",
        render: (r) => r.bank_reference ?? "",
      },
      {
        key: "match_reason",
        header: "เหตุผล",
        className: "min-w-[10rem] max-w-[16rem] hidden lg:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.match_reason ?? ""}</span>
        ),
      },
      {
        key: "match_confidence",
        header: "ความมั่นใจ",
        className: "text-right whitespace-nowrap hidden xl:table-cell",
        render: (r) => formatConfidence(r.match_confidence),
      },
      {
        key: "match_notes",
        header: "หมายเหตุ",
        className: "min-w-[12rem] max-w-[18rem] hidden xl:table-cell",
        render: (r) => (
          <span className="line-clamp-2 break-words">{r.match_notes ?? ""}</span>
        ),
      },
      {
        key: "source_sheet_name",
        header: "ชีทต้นทาง",
        className: "hidden xl:table-cell whitespace-nowrap",
        render: (r) => r.source_sheet_name ?? "",
      },
      {
        key: "source_row_number",
        header: "แถวต้นทาง",
        className: "text-right whitespace-nowrap hidden xl:table-cell",
        render: (r) => r.source_row_number ?? "",
      },
    ],
    []
  );

  function renderStatementMobileCard(row: StatementLineRow) {
    return (
      <button
        type="button"
        onClick={() => void openRaw(row)}
        className="w-full rounded-md border bg-white p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
      >
        <div className="flex items-start justify-between gap-2">
          <MatchStatusBadge status={row.match_status} />
          <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
            {row.txn_date}
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <div>
            <div className="text-xs text-muted-foreground">รายละเอียด</div>
            <div className="text-sm break-words">
              {row.description || "—"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">จำนวนเงิน</div>
              <div className="text-sm font-medium whitespace-nowrap">
                {Number(row.amount).toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ทิศทาง</div>
              <div className="text-sm">
                {row.direction === "in"
                  ? "เข้า"
                  : row.direction === "out"
                    ? "ออก"
                    : row.direction}
              </div>
            </div>
          </div>
          {row.match_reason ? (
            <div>
              <div className="text-xs text-muted-foreground">เหตุผล</div>
              <div className="text-sm line-clamp-2 break-words">
                {row.match_reason}
              </div>
            </div>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-3 sm:p-4 bg-slate-50 flex flex-col gap-3 sm:gap-4">
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
          <div className="min-w-0 flex-1 sm:min-w-[200px] sm:flex-none">
            <div className="text-xs text-muted-foreground mb-1">สถานะจับคู่</div>
            <Select
              value={matchStatus}
              onValueChange={(v) => {
                setOffset(0);
                setMatchStatus(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="pending">ยังไม่ประมวลผล</SelectItem>
                <SelectItem value="review">ต้องตรวจ</SelectItem>
                <SelectItem value="unmatched">จับคู่ไม่ได้</SelectItem>
                <SelectItem value="resolved">ตรวจแล้ว</SelectItem>
                <SelectItem value="manual">จับคู่ด้วยมือ</SelectItem>
                <SelectItem value="matched">จับคู่แล้ว</SelectItem>
                <SelectItem value="ignored">ไม่ใช้</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">ส่งออก</div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportCsv()}
              disabled={!canFetch || exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              ดาวน์โหลด CSV
            </Button>
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
          onRowClick={(row) => void openRaw(row)}
          loading={loading}
          tableMinWidthClassName="min-w-[52rem]"
          rowKey={(row) => row.id}
          mobileCardRender={renderStatementMobileCard}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดรายการเดินบัญชี</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.txn_date} • ${selected.description ?? ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-3 rounded-md border p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">สถานะจับคู่</div>
                  <MatchStatusBadge status={selected.match_status} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ความมั่นใจ</div>
                  <div>
                    {formatConfidence(selected.match_confidence) || "-"}
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

              {canOperatorEditMatchFields(selected.match_status) ? (
                <div className="grid gap-3 border-t pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        เหตุผล
                      </div>
                      <Input
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="เช่น จับคู่ด้วยมือจากใบสำคัญ P69…"
                        disabled={savingMatch}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">
                          ชนิดอ้างอิง
                        </div>
                        <Input
                          value={editRefType}
                          onChange={(e) => setEditRefType(e.target.value)}
                          placeholder="pvmas / pimas / …"
                          disabled={savingMatch}
                        />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">
                          รหัสอ้างอิง
                        </div>
                        <Input
                          value={editRefId}
                          onChange={(e) => setEditRefId(e.target.value)}
                          placeholder="VOUCNO / BILLNO"
                          disabled={savingMatch}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      หมายเหตุ
                    </div>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="รายละเอียดให้เจ้าหน้าที่อ่าน"
                      rows={3}
                      disabled={savingMatch}
                    />
                  </div>
                  {saveMatchError ? (
                    <p className="text-sm text-red-600">{saveMatchError}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingMatch}
                      onClick={() => void saveMatchUpdate()}
                    >
                      {savingMatch ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      บันทึกเหตุผล/หมายเหตุ
                    </Button>
                    {canOperatorTransitionMatchStatus(
                      selected.match_status,
                      "resolved"
                    ) ? (
                      <Button
                        type="button"
                        disabled={savingMatch}
                        onClick={() => void saveMatchUpdate("resolved")}
                      >
                        บันทึกเป็นตรวจแล้ว
                      </Button>
                    ) : null}
                    {canOperatorTransitionMatchStatus(
                      selected.match_status,
                      "manual"
                    ) ? (
                      <Button
                        type="button"
                        disabled={savingMatch}
                        onClick={() => void saveMatchUpdate("manual")}
                      >
                        บันทึกเป็นจับคู่ด้วยมือ
                      </Button>
                    ) : null}
                    {canOperatorTransitionMatchStatus(
                      selected.match_status,
                      "ignored"
                    ) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={savingMatch}
                        onClick={() => void saveMatchUpdate("ignored")}
                      >
                        ไม่ใช้
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 border-t pt-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">เหตุผล</div>
                    <div>{selected.match_reason || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      อ้างอิงที่จับคู่
                    </div>
                    <div>{formatMatchedRef(selected) || "-"}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground">หมายเหตุ</div>
                    <div className="whitespace-pre-wrap">
                      {selected.match_notes || "-"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="rounded-md border">
            <ScrollArea className="h-[320px]">
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
