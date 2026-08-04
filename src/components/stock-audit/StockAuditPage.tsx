"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageSearch,
  RefreshCcw,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";

import { formatCount } from "@/lib/bi/sales-format";
import {
  STOCK_AUDIT_BUCKETS,
  bucketMeta,
  type StockAuditBatch,
  type StockAuditBranch,
  type StockAuditBucket,
  type StockAuditLookup,
  type StockAuditOverview,
} from "@/lib/stock-audit/types";
import { cn } from "@/lib/utils";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type TabId = "overview" | "work" | "ondemand";

const PAGE_SIZE = 50;

function summaryCount(
  overview: StockAuditOverview | null,
  key: StockAuditBucket
): number {
  if (!overview) return 0;
  const s = overview.summary;
  switch (key) {
    case "never":
      return s.never_count;
    case "d30":
      return s.d30_count;
    case "d90":
      return s.d90_count;
    case "d180":
      return s.d180_count;
    case "d365":
      return s.d365_count;
    case "over_365":
      return s.over_365_count;
  }
}

export default function StockAuditPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [branch, setBranch] = useState<StockAuditBranch>("HQ");
  const [withStockOnly, setWithStockOnly] = useState(true);
  const [bucket, setBucket] = useState<StockAuditBucket | "ALL">("over_365");
  const [offset, setOffset] = useState(0);
  const [overview, setOverview] = useState<StockAuditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batchCount, setBatchCount] = useState(30);
  const [locationFilter, setLocationFilter] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [activeBatch, setActiveBatch] = useState<StockAuditBatch | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [markingBcode, setMarkingBcode] = useState<string | null>(null);

  const [lookupBcode, setLookupBcode] = useState("");
  const [lookup, setLookup] = useState<StockAuditLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [markingLookup, setMarkingLookup] = useState(false);

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          branch,
          with_stock_only: String(withStockOnly),
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (bucket !== "ALL") params.set("bucket", bucket);
        const res = await fetch(`/api/stock-audit/overview?${params}`, {
          signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "load failed");
        setOverview(data.overview as StockAuditOverview);
      } catch (e) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        setOverview(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branch, withStockOnly, bucket, offset]
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadOverview(ac.signal);
    return () => ac.abort();
  }, [loadOverview]);

  const openBatchId = overview?.open_batches?.[0]?.id ?? null;

  const loadBatch = useCallback(
    async (id: string, signal?: AbortSignal) => {
      setBatchLoading(true);
      try {
        const res = await fetch(`/api/stock-audit/batches/${id}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "load batch failed");
        setActiveBatch(data.batch as StockAuditBatch);
      } catch (e) {
        if (signal?.aborted) return;
        toast.error(e instanceof Error ? e.message : "โหลดชุดงานไม่สำเร็จ");
        setActiveBatch(null);
      } finally {
        if (!signal?.aborted) setBatchLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (tab !== "work" || !openBatchId) return;
    const ac = new AbortController();
    void loadBatch(openBatchId, ac.signal);
    return () => ac.abort();
  }, [tab, openBatchId, loadBatch]);

  async function createBatch() {
    setCreatingBatch(true);
    try {
      const res = await fetch("/api/stock-audit/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          count: batchCount,
          with_stock_only: withStockOnly,
          location: locationFilter.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "create failed");
      const batch = data.batch as StockAuditBatch;
      setActiveBatch(batch);
      setTab("work");
      toast.success(
        batch.items.length > 0
          ? `สร้างชุดตรวจ ${batch.items.length} รายการ`
          : "ไม่พบรายการที่ต้องตรวจ"
      );
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างชุดงานไม่สำเร็จ");
    } finally {
      setCreatingBatch(false);
    }
  }

  async function markItem(bcode: string, batchId?: string | null) {
    setMarkingBcode(bcode);
    try {
      const res = await fetch("/api/stock-audit/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          bcode,
          source: batchId ? "batch" : "ondemand",
          batch_id: batchId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "mark failed");
      toast.success(`บันทึกตรวจนับ ${bcode}`);
      if (batchId && activeBatch) {
        await loadBatch(batchId);
      }
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setMarkingBcode(null);
    }
  }

  async function skipItem(bcode: string, batchId: string) {
    setMarkingBcode(bcode);
    try {
      const res = await fetch("/api/stock-audit/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId, bcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "skip failed");
      setActiveBatch(data.batch as StockAuditBatch);
      toast.message(`ข้าม ${bcode}`);
      void loadOverview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ข้ามไม่สำเร็จ");
    } finally {
      setMarkingBcode(null);
    }
  }

  async function runLookup() {
    const bcode = lookupBcode.trim();
    if (!bcode) return;
    setLookupLoading(true);
    setLookup(null);
    try {
      const params = new URLSearchParams({ branch, bcode });
      const res = await fetch(`/api/stock-audit/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "lookup failed");
      setLookup(data.product as StockAuditLookup);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLookupLoading(false);
    }
  }

  async function markLookup() {
    if (!lookup?.found || !lookup.bcode) return;
    setMarkingLookup(true);
    try {
      await markItem(lookup.bcode, null);
      await runLookup();
    } finally {
      setMarkingLookup(false);
    }
  }

  const pendingItems =
    activeBatch?.items.filter((i) => i.status === "pending") ?? [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-slate-700" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            ตรวจนับสต็อก (Date Audit)
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          เลือก BCODE ที่ควรตรวจจากยอดขายช่วง 30 วันล่าสุด + สถานะตรวจในแอป
          นับที่ POS ตามปกติ แล้วกดบันทึกที่นี่ — ไม่ปรับยอดในระบบนี้
          วันที่ใน POS (DATEAUDIT) แสดงอ้างอิงเท่านั้น ไม่ใช้จัดสถานะ
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>สาขา</Label>
          <Select
            value={branch}
            onValueChange={(v) => {
              setBranch(v as StockAuditBranch);
              setOffset(0);
              setActiveBatch(null);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HQ">HQ</SelectItem>
              <SelectItem value="SYP">SYP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>สต็อก</Label>
          <Select
            value={withStockOnly ? "stock" : "all"}
            onValueChange={(v) => {
              setWithStockOnly(v === "stock");
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock">มีสต็อกเท่านั้น</SelectItem>
              <SelectItem value="all">ทุกรหัส</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void loadOverview()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          รีเฟรช
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ["overview", "ภาพรวม"],
            ["work", "งานวันนี้"],
            ["ondemand", "ตรวจตามรหัส"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "default" : "ghost"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {tab === "overview" ? (
        <section className="space-y-5">
          {loading && !overview ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : overview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SalesKpiCard
                  title="สินค้าในขอบเขต"
                  value={formatCount(overview.summary.total)}
                  hint={withStockOnly ? "มีสต็อก > 0" : "ทุกรหัสที่ยังใช้"}
                  icon={<PackageSearch className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="ตรวจในแอปวันนี้"
                  value={formatCount(overview.summary.marked_today_count)}
                  hint={`เคย mark ในแอป ${formatCount(overview.summary.app_marked_count)}`}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="ยังไม่เคยตรวจในแอป"
                  value={formatCount(overview.summary.never_count)}
                  hint={
                    overview.sales_from && overview.sales_to
                      ? `จัดลำดับงานด้วยยอดขาย ${overview.sales_from} → ${overview.sales_to}`
                      : "สถานะนับเฉพาะ mark ในแอป"
                  }
                />
                <SalesKpiCard
                  title="สด ≤ 30 วัน (แอป)"
                  value={formatCount(overview.summary.d30_count)}
                  hint="ไม่ใช้ POS DATEAUDIT จัด bucket"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBucket("ALL");
                    setOffset(0);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition",
                    bucket === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  ทั้งหมด {formatCount(overview.summary.total)}
                </button>
                {STOCK_AUDIT_BUCKETS.map((b) => {
                  const count = summaryCount(overview, b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => {
                        setBucket(b.key);
                        setOffset(0);
                      }}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition",
                        b.chip,
                        bucket === b.key && "ring-2 ring-slate-900 ring-offset-1"
                      )}
                    >
                      {b.label} {formatCount(count)}
                    </button>
                  );
                })}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">BCODE</th>
                      <th className="px-3 py-2">ชื่อ</th>
                      <th className="px-3 py-2">ที่เก็บ</th>
                      <th className="px-3 py-2 text-right">คงเหลือ</th>
                      <th className="px-3 py-2 text-right">ขาย 30 วัน</th>
                      <th className="px-3 py-2">วันตรวจ (แอป)</th>
                      <th className="px-3 py-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          ไม่มีรายการในกลุ่มนี้
                        </td>
                      </tr>
                    ) : (
                      overview.rows.map((row) => {
                        const meta = bucketMeta(row.bucket);
                        return (
                          <tr
                            key={row.bcode}
                            className={cn(
                              "border-t border-slate-100 border-l-[3px]",
                              meta.tone
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-xs sm:text-sm">
                              {row.bcode}
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-2">
                              {row.descr || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.location1 || "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCount(row.qty)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCount(row.sell_qty_period)}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.effective_date ?? "—"}
                              {row.days_since != null ? (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({formatCount(row.days_since)} วัน)
                                </span>
                              ) : null}
                              {row.pos_dateaudit ? (
                                <div className="text-[11px] text-muted-foreground">
                                  POS {row.pos_dateaudit}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="secondary"
                                className={cn("font-normal", meta.chip)}
                              >
                                {meta.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  แสดง {formatCount(overview.rows.length)} /{" "}
                  {formatCount(overview.row_total)}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={offset <= 0 || loading}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      loading || offset + PAGE_SIZE >= overview.row_total
                    }
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === "work" ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="batch-count">จำนวนวันนี้</Label>
              <Input
                id="batch-count"
                type="number"
                min={1}
                max={200}
                className="w-[120px]"
                value={batchCount}
                onChange={(e) =>
                  setBatchCount(
                    Math.min(200, Math.max(1, Number(e.target.value) || 1))
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="loc-filter">ที่เก็บ (ไม่บังคับ)</Label>
              <Input
                id="loc-filter"
                className="w-[200px]"
                placeholder="เช่น A1"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => void createBatch()}
              disabled={creatingBatch}
              className="gap-1.5"
            >
              {creatingBatch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              สร้างชุดตรวจอัจฉริยะ
            </Button>
            {overview?.open_batches?.length ? (
              <p className="text-xs text-muted-foreground sm:ml-auto">
                ชุดเปิดอยู่ {overview.open_batches.length} ชุด · ค้าง{" "}
                {formatCount(
                  overview.open_batches.reduce(
                    (n, b) => n + b.pending_count,
                    0
                  )
                )}{" "}
                รายการ
              </p>
            ) : null}
          </div>

          {batchLoading && !activeBatch ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : activeBatch ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">
                  {activeBatch.status === "open" ? "กำลังทำ" : "ปิดแล้ว"}
                </Badge>
                <span className="text-muted-foreground">
                  รอ {formatCount(activeBatch.pending_count)} · เสร็จ{" "}
                  {formatCount(activeBatch.done_count)} · ข้าม{" "}
                  {formatCount(activeBatch.skipped_count)}
                </span>
              </div>

              {pendingItems.length === 0 ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                  ชุดนี้ไม่มีรายการค้าง — สร้างชุดใหม่หรือไปแท็บภาพรวมได้
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                  {pendingItems.map((item) => (
                    <li
                      key={item.bcode}
                      className="flex flex-col gap-3 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-mono text-sm font-medium">
                          {item.bcode}
                        </p>
                        <p className="truncate text-sm text-slate-700">
                          {item.descr || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ที่เก็บ {item.location1 || "—"} · คงเหลือ{" "}
                          {formatCount(item.qty)} · ขาย 30 วัน{" "}
                          {formatCount(item.sell_qty_period)}
                          {item.app_dateaudit
                            ? ` · แอป ${item.app_dateaudit}`
                            : " · ยังไม่เคยตรวจในแอป"}
                          {item.pos_dateaudit
                            ? ` · POS ${item.pos_dateaudit}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={markingBcode === item.bcode}
                          onClick={() =>
                            void skipItem(item.bcode, activeBatch.id)
                          }
                        >
                          <SkipForward className="h-3.5 w-3.5" />
                          ข้าม
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1"
                          disabled={markingBcode === item.bcode}
                          onClick={() =>
                            void markItem(item.bcode, activeBatch.id)
                          }
                        >
                          {markingBcode === item.bcode ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          ตรวจแล้ว
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีชุดงานเปิด — เลือกจำนวนแล้วกดสร้างชุดตรวจอัจฉริยะ
              ระบบจัดลำดับจากยอดขาย 30 วันล่าสุด × ความเก่าของการตรวจในแอป
              (ไม่พึ่ง POS DATEAUDIT) และจัดกลุ่มตามที่เก็บ
            </p>
          )}
        </section>
      ) : null}

      {tab === "ondemand" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="lookup-bcode">BCODE</Label>
              <Input
                id="lookup-bcode"
                className="w-full font-mono sm:w-[240px]"
                value={lookupBcode}
                onChange={(e) => setLookupBcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runLookup();
                }}
                placeholder="สแกนหรือพิมพ์รหัส"
              />
            </div>
            <Button
              type="button"
              onClick={() => void runLookup()}
              disabled={lookupLoading || !lookupBcode.trim()}
              className="gap-1.5"
            >
              {lookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageSearch className="h-4 w-4" />
              )}
              ค้นหา
            </Button>
          </div>

          {lookup ? (
            lookup.found ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="font-mono text-lg font-semibold">
                    {lookup.bcode}
                  </p>
                  <p className="text-slate-800">{lookup.descr || "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {[lookup.brand, lookup.model].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">ที่เก็บ</dt>
                    <dd>{lookup.location1 || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">คงเหลือ</dt>
                    <dd>{formatCount(lookup.qty ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">ขาย 30 วัน</dt>
                    <dd>{formatCount(lookup.sell_qty_period ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">POS DATEAUDIT (อ้างอิง)</dt>
                    <dd>{lookup.pos_dateaudit || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">วันตรวจในแอป</dt>
                    <dd>
                      {lookup.app_dateaudit || "ยังไม่เคย"}
                      {lookup.app_audited_by
                        ? ` (${lookup.app_audited_by})`
                        : ""}
                    </dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  className="gap-1.5"
                  disabled={markingLookup}
                  onClick={() => void markLookup()}
                >
                  {markingLookup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  บันทึกว่าตรวจแล้ว
                </Button>
              </div>
            ) : (
              <p className="text-sm text-rose-700">ไม่พบรหัสนี้ในสาขา {branch}</p>
            )
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
