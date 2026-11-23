"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import BackButton from "@/components/common/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_CASH_STATUS_LABEL,
  EXPENSE_CASH_VOUCHER_STATUS_LABEL,
  formatBaht,
  type ExpenseCashRequest,
  type ExpenseCashStatus,
  type ExpenseCashVoucher,
} from "@/lib/expense/cash-request";
import { cn } from "@/lib/utils";

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

export default function ExpenseCashRequestsPage() {
  const [rows, setRows] = useState<ExpenseCashRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<ExpenseCashVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
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
      setRows(json.requests ?? []);
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
        setRows((prev) => {
          const next = prev.filter((r) => r.id !== json.request.id);
          return [json.request, ...next].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
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

  async function act(
    action: "approve" | "needs_info" | "reject" | "cancel" | "refresh"
  ) {
    if (!selected) return;
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
        setRows((prev) => {
          const next = prev.filter((r) => r.id !== json.request.id);
          return [json.request, ...next].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
        setSelectedId(json.request.id);
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

  const open = rows.filter(
    (r) => r.status === "pending" || r.status === "needs_info"
  );
  const canCancel =
    selected?.status === "approved" &&
    (!voucher?.status ||
      voucher.status === "pending" ||
      voucher.status === "creating");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton href="/expense" />
        <h1 className="text-2xl font-semibold sm:text-3xl">คำขอเบิกเงินสด</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
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

      <p className="text-sm text-slate-600">
        อนุมัติแล้วระบบสร้าง QR ตู้ Tiger ให้ผู้ขอทาง LINE — เช็กสถานะถอน /
        ยกเลิก QR ได้ที่นี่
      </p>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium">
            รายการ ({rows.length}) · รอทำ {open.length}
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-auto">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50",
                    selectedId === row.id && "bg-emerald-50/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">#{row.short_code}</span>
                    <Badge
                      className={cn(
                        "font-normal ring-1 ring-inset",
                        statusClass(row.status)
                      )}
                    >
                      {EXPENSE_CASH_STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                    <span className="ml-auto text-sm font-medium tabular-nums">
                      {formatBaht(row.amount)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700">
                    {row.requester_name || row.requester_line_user_id}
                  </div>
                  <div className="line-clamp-2 text-xs text-slate-500">
                    {row.reason}
                  </div>
                </button>
              </li>
            ))}
            {!loading && rows.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                ยังไม่มีคำขอ
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">เลือกคำขอจากรายการทางซ้าย</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">#{selected.short_code}</h2>
                <Badge
                  className={cn(
                    "font-normal ring-1 ring-inset",
                    statusClass(selected.status)
                  )}
                >
                  {EXPENSE_CASH_STATUS_LABEL[selected.status]}
                </Badge>
                {detailLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : null}
              </div>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">ผู้ขอ</dt>
                  <dd>
                    {selected.requester_name || selected.requester_line_user_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">จำนวน</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatBaht(selected.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">เหตุผล</dt>
                  <dd className="whitespace-pre-wrap">{selected.reason}</dd>
                </div>
                {selected.extra_reason ? (
                  <div>
                    <dt className="text-slate-500">รายละเอียดเพิ่ม</dt>
                    <dd className="whitespace-pre-wrap">{selected.extra_reason}</dd>
                  </div>
                ) : null}
                {selected.admin_note ? (
                  <div>
                    <dt className="text-slate-500">หมายเหตุแอดมิน</dt>
                    <dd className="whitespace-pre-wrap">{selected.admin_note}</dd>
                  </div>
                ) : null}
                {selected.voucher_attempt_id || voucher ? (
                  <div>
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
                  <div>
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

              {(selected.status === "pending" ||
                selected.status === "needs_info") && (
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
                      onClick={() => void act("approve")}
                    >
                      อนุมัติ + สร้าง QR
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={acting}
                      onClick={() => void act("needs_info")}
                    >
                      ส่งกลับขอข้อมูล
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={acting}
                      onClick={() => void act("reject")}
                    >
                      ปฏิเสธ
                    </Button>
                  </div>
                </>
              )}

              {(selected.status === "approved" ||
                selected.status === "paid" ||
                selected.voucher_attempt_id) && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={acting || detailLoading}
                    onClick={() => void act("refresh")}
                  >
                    เช็กสถานะ voucher
                  </Button>
                  {canCancel ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={acting}
                      onClick={() => void act("cancel")}
                    >
                      ยกเลิก QR
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
