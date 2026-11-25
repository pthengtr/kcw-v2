"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LifeBuoy, Loader2, RefreshCw } from "lucide-react";

import CommonImageDropzone from "@/components/common/CommonImageDropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_TARGETS,
  getSupportTarget,
  parseSupportTargetKey,
  supportTargetKey,
  type SupportTarget,
} from "@/lib/support/catalog";
import {
  TICKET_LIST_FILTERS,
  TICKET_PAGE_SIZE,
  filterSupportTickets,
  type TicketListFilter,
} from "@/lib/support/list-filters";
import {
  SUPPORT_BUCKET,
  SUPPORT_KIND_LABEL,
  SUPPORT_STATUS_LABEL,
  type SupportTicket,
  type SupportTicketEvent,
  type SupportTicketKind,
  type SupportTicketStatus,
} from "@/lib/support/types";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: SupportTicketStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "running":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "waiting":
      return "bg-violet-50 text-violet-800 ring-violet-200";
    case "done":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "failed":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    default:
      return "";
  }
}

function groupTargets(targets: SupportTarget[]) {
  const api = targets.filter((t) => t.group === "kcw-api");
  const pages = targets.filter((t) => t.group === "kcw-v2");
  const bi = targets.filter((t) => t.group === "kcw-v2-bi");
  const data = targets.filter((t) => t.group === "hq-data");
  return { api, pages, bi, data };
}

export function SupportPage() {
  const groups = useMemo(() => groupTargets(SUPPORT_TARGETS), []);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    ticket: SupportTicket;
    events: SupportTicketEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<SupportTicketKind>("bug");
  const [targetKey, setTargetKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [verifyComment, setVerifyComment] = useState("");
  const [listFilter, setListFilter] = useState<TicketListFilter>("open");
  const [titleQuery, setTitleQuery] = useState("");
  const [listPage, setListPage] = useState(1);

  const isDataQuery = kind === "data_query";

  const selectedTarget = useMemo(() => {
    const parsed = parseSupportTargetKey(targetKey);
    if (!parsed) return null;
    return getSupportTarget(parsed.source, parsed.id) ?? null;
  }, [targetKey]);

  const filteredTickets = useMemo(
    () => filterSupportTickets(tickets, listFilter, titleQuery),
    [tickets, listFilter, titleQuery]
  );

  const listPageCount = Math.max(
    1,
    Math.ceil(filteredTickets.length / TICKET_PAGE_SIZE)
  );

  const pagedTickets = useMemo(() => {
    const page = Math.min(listPage, listPageCount);
    const start = (page - 1) * TICKET_PAGE_SIZE;
    return filteredTickets.slice(start, start + TICKET_PAGE_SIZE);
  }, [filteredTickets, listPage, listPageCount]);

  useEffect(() => {
    setListPage(1);
  }, [listFilter, titleQuery]);

  useEffect(() => {
    if (listPage > listPageCount) setListPage(listPageCount);
  }, [listPage, listPageCount]);

  useEffect(() => {
    // Keep target in sync with kind: data_query ↔ hq-data only.
    if (isDataQuery) {
      if (!selectedTarget || selectedTarget.source !== "hq-data") {
        setTargetKey("hq-data:all");
      }
      return;
    }
    if (selectedTarget?.source === "hq-data") {
      setTargetKey("");
    }
  }, [isDataQuery, selectedTarget]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "โหลดรายการไม่สำเร็จ");
      setTickets(json.tickets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/support/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetail({ ticket: json.ticket, events: json.events ?? [] });
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedId) return;
    if (detail?.ticket.status === "pending" || detail?.ticket.status === "running") {
      const t = setInterval(() => {
        void loadDetail(selectedId);
        void loadTickets();
      }, 8000);
      return () => clearInterval(t);
    }
  }, [selectedId, detail?.ticket.status, loadDetail, loadTickets]);

  async function submitTicket() {
    if (!selectedTarget) {
      setError("เลือกบริการหรือหน้าให้ชัดเจนก่อนส่ง");
      return;
    }
    if (!title.trim()) {
      setError("กรุณาใส่หัวข้อ");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId,
          kind,
          targetSource: selectedTarget.source,
          targetId: selectedTarget.id,
          title: title.trim(),
          body: body.trim(),
          attachmentPaths,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "สร้างคำขอไม่สำเร็จ");
      setTitle("");
      setBody("");
      setAttachmentPaths([]);
      setDraftId(crypto.randomUUID());
      setTargetKey("");
      await loadTickets();
      await loadDetail(json.ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function act(action: "close" | "reopen") {
    if (!selectedId) return;
    if (action === "reopen" && !verifyComment.trim()) {
      setError("กรุณาใส่เหตุผลที่ยังไม่เสร็จเมื่อ reopen");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: verifyComment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "อัปเดตไม่สำเร็จ");
      setVerifyComment("");
      await loadTickets();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <LifeBuoy className="h-5 w-5 text-slate-700" />
            Support / แจ้งปัญหา
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Bug / Improvement: เลือกบริการหรือหน้า — agent ที่ HQ จะทำ PR ให้
            · ถามข้อมูล: ส่งคำถามไป agent บน HQ ที่เข้าถึง Supabase, KSS,
            kss-pc PARTS9 และผล kcw-analytic บน Google Drive
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadTickets();
            if (selectedId) void loadDetail(selectedId);
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          รีเฟรช
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <Card className="order-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">สร้างคำขอใหม่</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>ประเภท</Label>
                  <Select
                    value={kind}
                    onValueChange={(v) => setKind(v as SupportTicketKind)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">
                        {SUPPORT_KIND_LABEL.bug}
                      </SelectItem>
                      <SelectItem value="improvement">
                        {SUPPORT_KIND_LABEL.improvement}
                      </SelectItem>
                      <SelectItem value="data_query">
                        {SUPPORT_KIND_LABEL.data_query}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    {isDataQuery
                      ? "แหล่งข้อมูล (แนะนำให้ระบุ)"
                      : "บริการ / หน้า (ต้องเลือก)"}
                  </Label>
                  <Select value={targetKey} onValueChange={setTargetKey}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isDataQuery
                            ? "เลือกแหล่งข้อมูลบน HQ"
                            : "เลือกเป้าหมายให้ตรงที่สุด"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {isDataQuery ? (
                        <SelectGroup>
                          <SelectLabel>HQ data (hq-ubuntu-server)</SelectLabel>
                          {groups.data.map((t) => (
                            <SelectItem
                              key={supportTargetKey(t)}
                              value={supportTargetKey(t)}
                            >
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : (
                        <>
                          <SelectGroup>
                            <SelectLabel>kcw-api services</SelectLabel>
                            {groups.api.map((t) => (
                              <SelectItem
                                key={supportTargetKey(t)}
                                value={supportTargetKey(t)}
                              >
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>kcw-v2 pages</SelectLabel>
                            {groups.pages.map((t) => (
                              <SelectItem
                                key={supportTargetKey(t)}
                                value={supportTargetKey(t)}
                              >
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>kcw-v2 BI reports</SelectLabel>
                            {groups.bi.map((t) => (
                              <SelectItem
                                key={supportTargetKey(t)}
                                value={supportTargetKey(t)}
                              >
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedTarget ? (
                    <p className="text-xs text-slate-500">
                      {isDataQuery ? (
                        <>
                          Agent บน HQ จะตอบคำถามโดยใช้{" "}
                          <span className="font-medium text-slate-700">
                            {selectedTarget.label}
                          </span>
                          {selectedTarget.notes
                            ? ` — ${selectedTarget.notes}`
                            : null}
                        </>
                      ) : (
                        <>
                          Agent จะเปิด repo{" "}
                          <span className="font-medium text-slate-700">
                            {selectedTarget.repo}
                          </span>
                          {selectedTarget.codeRoots[0]
                            ? ` · เริ่มที่ ${selectedTarget.codeRoots[0]}`
                            : null}
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      {isDataQuery
                        ? "ยังไม่ได้เลือกแหล่งข้อมูล"
                        : "ยังไม่ได้เลือกเป้าหมาย — agent จะไม่รู้ว่าจะแก้ที่ไหน"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-title">หัวข้อ</Label>
                <Input
                  id="support-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isDataQuery ? "สรุปคำถามสั้นๆ" : "สรุปสั้นๆ"
                  }
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support-body">
                  {isDataQuery ? "คำถาม / รายละเอียด" : "รายละเอียด"}
                </Label>
                <Textarea
                  id="support-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    isDataQuery
                      ? "ถามข้อมูลที่ต้องการ เช่น ยอดขาย, สต็อก PARTS9, ไฟล์ analytic บน Drive…"
                      : "อธิบาย bug / improvement ที่ต้องการ"
                  }
                  rows={5}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  {isDataQuery
                    ? "ไฟล์แนบ (ถ้ามี — ภาพ/PDF ที่ช่วยอธิบายคำถาม)"
                    : "ไฟล์แนบ (ภาพ / PDF ตัวอย่างผลลัพธ์หรือดีไซน์)"}
                </Label>
                <CommonImageDropzone
                  folder="public/support"
                  receiptUuid={draftId}
                  bucket={SUPPORT_BUCKET}
                  maxFiles={10}
                  maxSize={15 * 1024 * 1024}
                  onUploaded={(objects) => {
                    setAttachmentPaths((prev) => [
                      ...prev,
                      ...objects.map((o) => o.path),
                    ]);
                  }}
                />
                {attachmentPaths.length > 0 ? (
                  <p className="text-xs text-slate-500">
                    แนบแล้ว {attachmentPaths.length} ไฟล์
                  </p>
                ) : null}
              </div>

              <Button
                disabled={saving || !selectedTarget || !title.trim()}
                onClick={() => void submitTicket()}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                ส่งคำขอ
              </Button>
            </CardContent>
          </Card>

          <Card className="order-1">
            <CardHeader className="py-2.5 pb-1.5">
              <CardTitle className="text-base">คำขอของฉัน</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 pt-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1">
                  {TICKET_LIST_FILTERS.map((f) => (
                    <Button
                      key={f.value}
                      type="button"
                      size="sm"
                      variant={listFilter === f.value ? "default" : "outline"}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setListFilter(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
                <Input
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  placeholder="ค้นหาจากหัวข้อคำขอ"
                  className="h-8 text-sm"
                  aria-label="ค้นหาจากหัวข้อคำขอ"
                />
              </div>

              {loading ? (
                <p className="text-sm text-slate-500">กำลังโหลด…</p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีคำขอ</p>
              ) : filteredTickets.length === 0 ? (
                <p className="text-sm text-slate-500">ไม่พบคำขอตามตัวกรอง</p>
              ) : (
                <>
                  <div className="flex flex-col gap-0.5">
                    {pagedTickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void loadDetail(t.id)}
                        className={cn(
                          "rounded border px-2 py-1 text-left transition",
                          selectedId === t.id
                            ? "border-slate-400 bg-slate-50"
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight text-slate-900">
                            {t.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 shrink-0 px-1.5 text-[10px] leading-none ring-1",
                              statusBadgeClass(t.status)
                            )}
                          >
                            {SUPPORT_STATUS_LABEL[t.status]}
                          </Badge>
                        </div>
                        <p className="truncate text-[10px] leading-tight text-slate-500">
                          {t.target_label} ·{" "}
                          {SUPPORT_KIND_LABEL[t.kind] ?? t.kind} ·{" "}
                          {new Date(t.created_at).toLocaleString("th-TH")}
                        </p>
                      </button>
                    ))}
                  </div>
                  {filteredTickets.length > TICKET_PAGE_SIZE ? (
                    <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-slate-600">
                      <span>
                        หน้า {Math.min(listPage, listPageCount)} /{" "}
                        {listPageCount} ·{" "}
                        {filteredTickets.length.toLocaleString("th-TH")} รายการ
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={listPage <= 1}
                          onClick={() =>
                            setListPage((p) => Math.max(1, p - 1))
                          }
                        >
                          ก่อนหน้า
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={listPage >= listPageCount}
                          onClick={() =>
                            setListPage((p) => Math.min(listPageCount, p + 1))
                          }
                        >
                          ถัดไป
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      {filteredTickets.length.toLocaleString("th-TH")} รายการ
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">รายละเอียด</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!detail ? (
              <p className="text-sm text-slate-500">เลือกคำขอจากรายการเพื่อดูสถานะ</p>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {detail.ticket.title}
                    </h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ring-1",
                        statusBadgeClass(detail.ticket.status)
                      )}
                    >
                      {SUPPORT_STATUS_LABEL[detail.ticket.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    {detail.ticket.target_label} ({detail.ticket.target_source}/
                    {detail.ticket.target_id}) ·{" "}
                    {SUPPORT_KIND_LABEL[detail.ticket.kind] ??
                      detail.ticket.kind}
                  </p>
                  {detail.ticket.pr_url ? (
                    <a
                      href={detail.ticket.pr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-sky-700 underline"
                    >
                      Pull request
                    </a>
                  ) : null}
                  {detail.ticket.error_message ? (
                    <p className="text-sm text-rose-700">
                      {detail.ticket.error_message}
                    </p>
                  ) : null}
                </div>

                <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
                  {detail.ticket.body || "(ไม่มีรายละเอียด)"}
                </div>

                {(() => {
                  const answer = [...detail.events]
                    .reverse()
                    .find((ev) => ev.event_type === "answered" && ev.comment);
                  if (!answer?.comment) return null;
                  return (
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-medium text-slate-800">
                        คำตอบจาก HQ agent
                      </h3>
                      <div className="whitespace-pre-wrap rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-slate-800">
                        {answer.comment}
                      </div>
                    </div>
                  );
                })()}

                {(detail.ticket.status === "waiting" ||
                  detail.ticket.status === "failed" ||
                  detail.ticket.status === "done") && (
                  <div className="space-y-2 rounded-md border border-slate-200 p-3">
                    <Label>ตรวจผล / ปิดหรือ reopen</Label>
                    <Textarea
                      value={verifyComment}
                      onChange={(e) => setVerifyComment(e.target.value)}
                      placeholder={
                        detail.ticket.status === "waiting"
                          ? "ถ้า reopen ต้องใส่เหตุผลว่าทำไมยังไม่เสร็จ"
                          : "ความคิดเห็น (ถ้ามี)"
                      }
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      {detail.ticket.status !== "done" ? (
                        <Button
                          variant="default"
                          disabled={saving}
                          onClick={() => void act("close")}
                        >
                          ปิดคำขอ (done)
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => void act("reopen")}
                      >
                        Reopen
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-800">Timeline</h3>
                  <ul className="space-y-2">
                    {detail.events.map((ev) => (
                      <li
                        key={ev.id}
                        className="rounded-md border border-slate-100 px-3 py-2 text-xs text-slate-600"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-slate-800">
                            {ev.event_type}
                          </span>
                          <span>
                            {new Date(ev.created_at).toLocaleString("th-TH")}
                          </span>
                        </div>
                        {ev.comment ? (
                          <p className="mt-1 whitespace-pre-wrap">{ev.comment}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
