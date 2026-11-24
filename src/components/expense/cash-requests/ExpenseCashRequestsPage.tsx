"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";

import BackButton from "@/components/common/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { downloadExpenseCashExcel } from "@/lib/expense/cash-request-excel";
import {
  canUpdateExpenseCashAccounting,
  EMPTY_EXPENSE_CASH_FILTERS,
  filterExpenseCashRequests,
  formatExpenseCashDate,
  formatExpenseCashDateTime,
  summarizeExpenseCashRequests,
  type ExpenseCashFilters,
} from "@/lib/expense/cash-request-filter";
import {
  EXPENSE_CASH_ACCOUNTING_LABEL,
  EXPENSE_CASH_ACCOUNTING_SKIP_REASON_LABEL,
  EXPENSE_CASH_STATUS_LABEL,
  EXPENSE_CASH_VOUCHER_STATUS_LABEL,
  expenseCashAccountingSkipText,
  expenseCashDetailText,
  formatBaht,
  formatBahtNumber,
  normalizeExpenseCashRequest,
  type ExpenseCashAccountingSkipReason,
  type ExpenseCashAccountingStatus,
  type ExpenseCashBranch,
  type ExpenseCashRequest,
  type ExpenseCashStatus,
  type ExpenseCashVoucher,
} from "@/lib/expense/cash-request";
import { cn } from "@/lib/utils";

const SKIP_REASON_OPTIONS = Object.keys(
  EXPENSE_CASH_ACCOUNTING_SKIP_REASON_LABEL
) as ExpenseCashAccountingSkipReason[];

function statusClass(status: ExpenseCashStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "needs_info":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "approved":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "paid":
      return "bg-teal-50 text-teal-800 ring-teal-200";
    case "rejected":
    case "cancelled":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function accountingClass(status: ExpenseCashAccountingStatus) {
  switch (status) {
    case "recorded":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    case "skipped":
      return "bg-slate-100 text-slate-700 ring-slate-300";
    default:
      return "bg-orange-50 text-orange-800 ring-orange-200";
  }
}

function StatusBadge({ status }: { status: ExpenseCashStatus }) {
  return (
    <Badge
      className={cn("font-normal ring-1 ring-inset", statusClass(status))}
    >
      {EXPENSE_CASH_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function AccountingBadge({
  status,
}: {
  status: ExpenseCashAccountingStatus;
}) {
  return (
    <Badge
      className={cn("font-normal ring-1 ring-inset", accountingClass(status))}
    >
      {EXPENSE_CASH_ACCOUNTING_LABEL[status]}
    </Badge>
  );
}

function mergeRequest(
  prev: ExpenseCashRequest[],
  next: ExpenseCashRequest
): ExpenseCashRequest[] {
  const rest = prev.filter((r) => r.id !== next.id);
  return [next, ...rest].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function DetailPanel({
  selected,
  voucher,
  detailLoading,
  acting,
  note,
  setNote,
  error,
  canManage,
  onAct,
}: {
  selected: ExpenseCashRequest | null;
  voucher: ExpenseCashVoucher | null;
  detailLoading: boolean;
  acting: boolean;
  note: string;
  setNote: (v: string) => void;
  error: string | null;
  canManage: boolean;
  onAct: (
    action: "approve" | "needs_info" | "reject" | "cancel" | "refresh"
  ) => void;
}) {
  if (!selected) {
    return (
      <p className="text-sm text-slate-500">เลือกคำขอจากรายการเพื่อดูรายละเอียด</p>
    );
  }

  const canCancel =
    canManage &&
    selected.status === "approved" &&
    (!voucher?.status ||
      voucher.status === "pending" ||
      voucher.status === "creating");
  const skipText = expenseCashAccountingSkipText(selected);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">#{selected.short_code}</h2>
        <StatusBadge status={selected.status} />
        <AccountingBadge status={selected.accounting_status} />
        {detailLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">วันที่</dt>
          <dd>{formatExpenseCashDate(selected.created_at)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">วันที่ถอนเงิน</dt>
          <dd>{formatExpenseCashDate(selected.paid_at)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">สาขา</dt>
          <dd>{selected.branch ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">ผู้ขอ</dt>
          <dd>{selected.requester_name || selected.requester_line_user_id}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">จำนวน</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatBaht(selected.amount)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">รายละเอียดค่าใช้จ่าย</dt>
          <dd className="whitespace-pre-wrap">
            {expenseCashDetailText(selected) || "—"}
          </dd>
        </div>
        {selected.admin_note ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">หมายเหตุแอดมิน</dt>
            <dd className="whitespace-pre-wrap">{selected.admin_note}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-slate-500">สถานะการลงค่าใช้จ่าย</dt>
          <dd className="space-y-1">
            <AccountingBadge status={selected.accounting_status} />
            {skipText ? (
              <div className="text-xs text-slate-600">เหตุผล: {skipText}</div>
            ) : null}
            {selected.accounting_at ? (
              <div className="text-xs text-slate-500">
                โดย {selected.accounting_by_name || "—"} ·{" "}
                {formatExpenseCashDateTime(selected.accounting_at)}
              </div>
            ) : null}
          </dd>
        </div>
        {selected.voucher_attempt_id || voucher ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Voucher Tiger</dt>
            <dd className="space-y-1">
              <div>
                สถานะ:{" "}
                <span className="font-medium">
                  {voucher?.status
                    ? EXPENSE_CASH_VOUCHER_STATUS_LABEL[voucher.status] ??
                      voucher.status
                    : "—"}
                </span>
              </div>
              {voucher?.voucher_num ? (
                <div className="font-mono text-xs">
                  รหัส: {voucher.voucher_num}
                </div>
              ) : null}
            </dd>
          </div>
        ) : null}
        {selected.qr_image_url && selected.status === "approved" ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">QR</dt>
            <dd>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.qr_image_url}
                alt="Tiger voucher QR"
                className="mt-1 h-48 w-48 rounded border border-slate-200 bg-white p-2"
              />
            </dd>
          </div>
        ) : null}
      </dl>

      {canManage &&
        (selected.status === "pending" || selected.status === "needs_info") && (
        <>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุสำหรับ ส่งกลับ / ปฏิเสธ"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={acting}
              onClick={() => onAct("approve")}
            >
              อนุมัติ + สร้าง QR
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={acting}
              onClick={() => onAct("needs_info")}
            >
              ส่งกลับขอข้อมูล
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={acting}
              onClick={() => onAct("reject")}
            >
              ปฏิเสธ
            </Button>
          </div>
        </>
      )}

      {canManage &&
        (selected.status === "approved" ||
          selected.status === "paid" ||
          selected.voucher_attempt_id) && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={acting || detailLoading}
            onClick={() => onAct("refresh")}
          >
            เช็กสถานะ voucher
          </Button>
          {canCancel ? (
            <Button
              type="button"
              variant="destructive"
              disabled={acting}
              onClick={() => onAct("cancel")}
            >
              ยกเลิก QR
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ExpenseCashRequestsPage({
  canManage = false,
}: {
  canManage?: boolean;
}) {
  const [rows, setRows] = useState<ExpenseCashRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<ExpenseCashVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [accountingActing, setAccountingActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [filters, setFilters] = useState<ExpenseCashFilters>(
    EMPTY_EXPENSE_CASH_FILTERS
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [desktopDetailOpen, setDesktopDetailOpen] = useState(false);
  const [batchBranch, setBatchBranch] = useState<"keep" | ExpenseCashBranch>(
    "keep"
  );
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] =
    useState<ExpenseCashAccountingSkipReason>("system_test");
  const [skipNote, setSkipNote] = useState("");

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const filtered = useMemo(
    () => filterExpenseCashRequests(rows, filters),
    [rows, filters]
  );

  const summary = useMemo(
    () => summarizeExpenseCashRequests(filtered),
    [filtered]
  );

  const selectableFiltered = useMemo(
    () =>
      canManage ? filtered.filter(canUpdateExpenseCashAccounting) : [],
    [filtered, canManage]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/expense/cash-requests");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "โหลดไม่สำเร็จ");
        setRows([]);
        return;
      }
      const next = ((json.requests ?? []) as ExpenseCashRequest[]).map((r) =>
        normalizeExpenseCashRequest(r)
      );
      setRows(next);
      setSelectedIds((prev) => {
        const ids = new Set(next.map((r) => r.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    } catch {
      setError("โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/expense/cash-requests/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "โหลดรายละเอียดไม่สำเร็จ");
        setVoucher(null);
        return;
      }
      if (json.request) {
        const normalized = normalizeExpenseCashRequest(json.request);
        setRows((prev) => mergeRequest(prev, normalized));
      }
      setVoucher(json.voucher ?? null);
    } catch {
      setError("โหลดรายละเอียดไม่สำเร็จ");
      setVoucher(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setVoucher(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function openDetail(id: string, mode: "mobile" | "desktop") {
    setSelectedId(id);
    if (mode === "mobile") {
      setMobileDetailOpen(true);
      setDesktopDetailOpen(false);
    } else {
      setDesktopDetailOpen(true);
      setMobileDetailOpen(false);
    }
  }

  function closeDetail() {
    setMobileDetailOpen(false);
    setDesktopDetailOpen(false);
    setError(null);
  }

  async function act(
    action: "approve" | "needs_info" | "reject" | "cancel" | "refresh"
  ) {
    if (!canManage || !selected) return;
    if ((action === "needs_info" || action === "reject") && !note.trim()) {
      setError("กรุณาใส่หมายเหตุ");
      return;
    }
    if (action === "cancel") {
      const ok = window.confirm(
        `ยกเลิก QR ของคำขอ #${selected.short_code}? ผู้ขอจะสแกนไม่ได้แล้ว`
      );
      if (!ok) return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/expense/cash-requests/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "ทำรายการไม่สำเร็จ");
        return;
      }
      setNote("");
      if (json.request) {
        const normalized = normalizeExpenseCashRequest(json.request);
        setRows((prev) => mergeRequest(prev, normalized));
        setSelectedId(normalized.id);
      }
      if ("voucher" in json) {
        setVoucher(json.voucher ?? null);
      } else if (action !== "refresh") {
        await loadDetail(selected.id);
      }
      if (action !== "refresh") {
        await load();
      }
    } catch {
      setError("ทำรายการไม่สำเร็จ");
    } finally {
      setActing(false);
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllFiltered(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of selectableFiltered) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  const selectedPaidIds = useMemo(
    () =>
      [...selectedIds].filter((id) => {
        const row = rows.find((r) => r.id === id);
        return row ? canUpdateExpenseCashAccounting(row) : false;
      }),
    [selectedIds, rows]
  );

  const allSelectableChecked =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((r) => selectedIds.has(r.id));

  async function updateAccounting(
    accounting_status: ExpenseCashAccountingStatus,
    extra?: {
      accounting_skip_reason?: ExpenseCashAccountingSkipReason;
      accounting_skip_note?: string;
    }
  ) {
    if (!canManage) return;
    if (selectedPaidIds.length === 0) {
      setError("เลือกรายการที่ถอนเงินแล้วอย่างน้อย 1 รายการ");
      return;
    }
    setAccountingActing(true);
    setError(null);
    try {
      const res = await fetch("/api/expense/cash-requests/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedPaidIds,
          accounting_status,
          ...(batchBranch === "keep" ? {} : { branch: batchBranch }),
          ...(extra?.accounting_skip_reason
            ? { accounting_skip_reason: extra.accounting_skip_reason }
            : {}),
          ...(extra?.accounting_skip_note
            ? { accounting_skip_note: extra.accounting_skip_note }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "อัปเดตสถานะบัญชีไม่สำเร็จ");
        return;
      }
      const updated = ((json.requests ?? []) as ExpenseCashRequest[]).map((r) =>
        normalizeExpenseCashRequest(r)
      );
      setRows((prev) => {
        let next = prev;
        for (const row of updated) next = mergeRequest(next, row);
        return next;
      });
      setSelectedIds(new Set());
      setSkipDialogOpen(false);
      setSkipNote("");
      setSkipReason("system_test");
    } catch {
      setError("อัปเดตสถานะบัญชีไม่สำเร็จ");
    } finally {
      setAccountingActing(false);
    }
  }

  function confirmSkipAccounting() {
    if (skipReason === "other" && !skipNote.trim()) {
      setError("กรุณาระบุเหตุผลเมื่อเลือกอื่น ๆ");
      return;
    }
    void updateAccounting("skipped", {
      accounting_skip_reason: skipReason,
      accounting_skip_note:
        skipReason === "other" ? skipNote.trim() : skipNote.trim() || undefined,
    });
  }

  const openCount = rows.filter(
    (r) => r.status === "pending" || r.status === "needs_info"
  ).length;

  const detailProps = {
    selected,
    voucher,
    detailLoading,
    acting,
    note,
    setNote,
    error,
    canManage,
    onAct: (action: "approve" | "needs_info" | "reject" | "cancel" | "refresh") => {
      void act(action);
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton href="/expense" />
        <h1 className="text-2xl font-semibold sm:text-3xl">คำขอเบิกเงินสด</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadExpenseCashExcel(filtered)}
            disabled={loading || filtered.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            รีเฟรช
          </Button>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        {canManage
          ? "อนุมัติแล้วระบบสร้าง QR ตู้ Tiger ให้ผู้ขอทาง LINE — เช็กสถานะถอน / ยกเลิก QR ได้ที่นี่ และบัญชีสามารถทำเครื่องหมายลงค่าใช้จ่ายเป็นชุดได้"
          : "ดูรายการคำขอเบิกเงินสดและสถานะได้ — การอนุมัติ / ส่งกลับ / ปฏิเสธ และการลงค่าใช้จ่ายสงวนไว้สำหรับแอดมิน"}
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="sm:col-span-2 xl:col-span-2">
            <Label htmlFor="cash-q" className="text-xs text-slate-500">
              ค้นหา
            </Label>
            <Input
              id="cash-q"
              value={filters.query}
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
              placeholder="เลขที่คำขอ / ผู้เบิก / รายละเอียด"
            />
          </div>
          <div>
            <Label htmlFor="cash-from" className="text-xs text-slate-500">
              ถอนเงินตั้งแต่
            </Label>
            <Input
              id="cash-from"
              type="date"
              value={filters.paidFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, paidFrom: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="cash-to" className="text-xs text-slate-500">
              ถอนเงินถึง
            </Label>
            <Input
              id="cash-to"
              type="date"
              value={filters.paidTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, paidTo: e.target.value }))
              }
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">สาขา</Label>
            <Select
              value={filters.branch}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  branch: value as ExpenseCashFilters["branch"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="HQ">HQ</SelectItem>
                <SelectItem value="SYP">SYP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">สถานะการเบิก</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  status: value as ExpenseCashFilters["status"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {(
                  Object.keys(EXPENSE_CASH_STATUS_LABEL) as ExpenseCashStatus[]
                ).map((key) => (
                  <SelectItem key={key} value={key}>
                    {EXPENSE_CASH_STATUS_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">สถานะลงค่าใช้จ่าย</Label>
            <Select
              value={filters.accountingStatus}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  accountingStatus:
                    value as ExpenseCashFilters["accountingStatus"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="pending">รอลงค่าใช้จ่าย</SelectItem>
                <SelectItem value="recorded">ลงค่าใช้จ่ายแล้ว</SelectItem>
                <SelectItem value="skipped">ไม่ลงค่าใช้จ่าย</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilters(EMPTY_EXPENSE_CASH_FILTERS)}
          >
            ล้างตัวกรอง
          </Button>
          <span className="text-sm text-slate-600">
            แสดง {summary.count.toLocaleString("th-TH")} รายการ · รวม{" "}
            <span className="font-semibold tabular-nums">
              {formatBaht(summary.totalAmount)}
            </span>
            {" · รอลงค่าใช้จ่าย "}
            {summary.pendingAccountingCount.toLocaleString("th-TH")} รายการ (
            <span className="font-semibold tabular-nums">
              {formatBaht(summary.pendingAccountingAmount)}
            </span>
            )
            {rows.length ? ` · รอทำ ${openCount}` : null}
          </span>
        </div>
      </div>

      {canManage && selectedPaidIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="text-sm font-medium text-indigo-900">
            เลือกแล้ว {selectedPaidIds.length} รายการ (ถอนแล้ว)
          </div>
          <div className="sm:w-40">
            <Label className="text-xs text-slate-600">ตั้งสาขา (ถ้าต้องการ)</Label>
            <Select
              value={batchBranch}
              onValueChange={(v) =>
                setBatchBranch(v as "keep" | ExpenseCashBranch)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">ไม่เปลี่ยน</SelectItem>
                <SelectItem value="HQ">HQ</SelectItem>
                <SelectItem value="SYP">SYP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={accountingActing}
              onClick={() => void updateAccounting("recorded")}
            >
              ลงค่าใช้จ่ายแล้ว
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={accountingActing}
              onClick={() => void updateAccounting("pending")}
            >
              รอลงค่าใช้จ่าย
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={accountingActing}
              onClick={() => {
                setError(null);
                setSkipDialogOpen(true);
              }}
            >
              ไม่ลงค่าใช้จ่าย
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              ยกเลิกการเลือก
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={skipDialogOpen}
        onOpenChange={(open) => {
          setSkipDialogOpen(open);
          if (!open) {
            setSkipNote("");
            setSkipReason("system_test");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ไม่ลงค่าใช้จ่าย</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            เลือกเหตุผลสำหรับ {selectedPaidIds.length} รายการที่ถอนแล้ว
            (ไม่กระทบยอดถอนเงินจริงผ่าน Tiger)
          </p>
          <RadioGroup
            value={skipReason}
            onValueChange={(v) =>
              setSkipReason(v as ExpenseCashAccountingSkipReason)
            }
            className="gap-3"
          >
            {SKIP_REASON_OPTIONS.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <RadioGroupItem value={key} id={`skip-reason-${key}`} />
                <Label htmlFor={`skip-reason-${key}`} className="font-normal">
                  {EXPENSE_CASH_ACCOUNTING_SKIP_REASON_LABEL[key]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {skipReason === "other" ? (
            <div className="space-y-1.5">
              <Label htmlFor="skip-note">ระบุเหตุผล</Label>
              <Textarea
                id="skip-note"
                value={skipNote}
                onChange={(e) => setSkipNote(e.target.value)}
                placeholder="เช่น รายการซ้ำ / ยกเลิกหลังถอน"
                rows={3}
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSkipDialogOpen(false)}
              disabled={accountingActing}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              disabled={accountingActing}
              onClick={confirmSkipAccounting}
            >
              {accountingActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && !selectedId ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Mobile cards */}
      <div className="lg:hidden">
        <ul className="flex flex-col gap-2">
          {filtered.map((row) => {
            const selectable =
              canManage && canUpdateExpenseCashAccounting(row);
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-xl border border-slate-200 bg-white p-3",
                  selectedId === row.id &&
                    mobileDetailOpen &&
                    "ring-2 ring-emerald-300"
                )}
              >
                <div className="flex items-start gap-3">
                  {canManage ? (
                    selectable ? (
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={(v) =>
                          toggleSelect(row.id, v === true)
                        }
                        aria-label={`เลือก #${row.short_code}`}
                        className="mt-1"
                      />
                    ) : (
                      <span className="mt-1 h-4 w-4" />
                    )
                  ) : null}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => openDetail(row.id, "mobile")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{row.short_code}</span>
                      <span className="text-xs text-slate-500">
                        {formatExpenseCashDate(
                          row.paid_at || row.created_at
                        )}
                      </span>
                      <span className="ml-auto text-sm font-semibold tabular-nums">
                        {formatBahtNumber(row.amount)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {row.requester_name || row.requester_line_user_id}
                      {row.branch ? ` · ${row.branch}` : ""}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {expenseCashDetailText(row)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <StatusBadge status={row.status} />
                      <AccountingBadge status={row.accounting_status} />
                    </div>
                  </button>
                </div>
              </li>
            );
          })}
          {!loading && filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              ไม่พบรายการตามตัวกรอง
            </li>
          ) : null}
        </ul>
      </div>

      {/* Desktop table — full width; detail opens as right drawer */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600">
              <tr>
                {canManage ? (
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={allSelectableChecked}
                      onCheckedChange={(v) =>
                        toggleSelectAllFiltered(v === true)
                      }
                      aria-label="เลือกทั้งหมดที่ถอนแล้ว"
                      disabled={selectableFiltered.length === 0}
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2 font-medium">เลขที่</th>
                <th className="px-3 py-2 font-medium">วันที่</th>
                <th className="px-3 py-2 font-medium">สาขา</th>
                <th className="px-3 py-2 font-medium">รายละเอียด</th>
                <th className="px-3 py-2 text-right font-medium">จำนวนเงิน</th>
                <th className="px-3 py-2 font-medium">สถานะเบิก</th>
                <th className="px-3 py-2 font-medium">ลงค่าใช้จ่าย</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const selectable =
                  canManage && canUpdateExpenseCashAccounting(row);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                      selectedId === row.id &&
                        desktopDetailOpen &&
                        "bg-emerald-50/70"
                    )}
                    onClick={() => openDetail(row.id, "desktop")}
                  >
                    {canManage ? (
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectable ? (
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={(v) =>
                              toggleSelect(row.id, v === true)
                            }
                            aria-label={`เลือก #${row.short_code}`}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      #{row.short_code}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatExpenseCashDate(row.paid_at || row.created_at)}
                    </td>
                    <td className="px-3 py-2">{row.branch ?? "—"}</td>
                    <td className="max-w-[18rem] px-3 py-2">
                      <div className="truncate font-medium text-slate-800">
                        {row.requester_name || row.requester_line_user_id}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {expenseCashDetailText(row)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatBahtNumber(row.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <AccountingBadge status={row.accounting_status} />
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 8 : 7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    ไม่พบรายการตามตัวกรอง
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile detail sheet */}
      <Sheet
        open={mobileDetailOpen && !!selected}
        onOpenChange={(open) => {
          if (!open) closeDetail();
          else setMobileDetailOpen(true);
        }}
      >
        <SheetContent
          side="bottom"
          className="flex max-h-[90vh] flex-col gap-0 overflow-y-auto rounded-t-2xl p-0"
        >
          <SheetHeader className="border-b border-slate-100 px-4 py-3 pr-12 text-left">
            <SheetTitle>รายละเอียดคำขอ</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <DetailPanel {...detailProps} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop detail drawer — overlays without shrinking the table */}
      <Sheet
        open={desktopDetailOpen && !!selected}
        onOpenChange={(open) => {
          if (!open) closeDetail();
          else setDesktopDetailOpen(true);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-100 px-4 py-3 pr-12 text-left">
            <SheetTitle>รายละเอียดคำขอ</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <DetailPanel {...detailProps} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
