"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  PackageSearch,
  RefreshCcw,
  SkipForward,
  Target,
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
import { STOCK_AUDIT_DAILY_TARGET } from "@/lib/home/workspace-todos";
import { cn } from "@/lib/utils";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import StockAuditDailyChart from "@/components/stock-audit/StockAuditDailyChart";
import StockAuditFreshnessPie from "@/components/stock-audit/StockAuditFreshnessPie";
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

type TabId = "work" | "overview" | "ondemand";

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
  const [tab, setTab] = useState<TabId>("work");
  const [branch, setBranch] = useState<StockAuditBranch>("HQ");
  const [withStockOnly, setWithStockOnly] = useState(true);
  const [bucket, setBucket] = useState<StockAuditBucket | "ALL">("never");
  const [offset, setOffset] = useState(0);
  const [overview, setOverview] = useState<StockAuditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batchCount, setBatchCount] = useState(STOCK_AUDIT_DAILY_TARGET);
  const [locationFilter, setLocationFilter] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [activeBatch, setActiveBatch] = useState<StockAuditBatch | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [markingBcode, setMarkingBcode] = useState<string | null>(null);
  const [expandedBcode, setExpandedBcode] = useState<string | null>(null);

  const [lookupBcode, setLookupBcode] = useState("");
  const [lookup, setLookup] = useState<StockAuditLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [markingLookup, setMarkingLookup] = useState(false);
  const [showLookupExtra, setShowLookupExtra] = useState(false);

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
          ? `ได้รายการตรวจ ${batch.items.length} ชิ้น`
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
      toast.success(`บันทึกแล้ว ${bcode}`);
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
    setShowLookupExtra(false);
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
  const todayDone = overview?.summary.marked_today_count ?? 0;
  const weekDone = overview?.summary.marked_week_count ?? 0;
  const todayProgress = Math.min(100, Math.round((100 * todayDone) / STOCK_AUDIT_DAILY_TARGET));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-teal-800" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            ตรวจนับสต็อก
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          ระบบเลือกสินค้าขายดีที่ควรไปนับให้ · นับที่ POS ตามปกติ ·
          แล้วกด “ตรวจแล้ว” ที่นี่
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
          <Label>ขอบเขต</Label>
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
              <SelectItem value="stock">มีของในสต็อก</SelectItem>
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

      {/* Compact progress strip always visible */}
      {overview ? (
        <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-teal-950">
              วันนี้ตรวจแล้ว {formatCount(todayDone)} / เป้า{" "}
              {formatCount(STOCK_AUDIT_DAILY_TARGET)}
            </span>
            <span className="text-xs text-teal-900/70">
              7 วันนี้ {formatCount(weekDone)} รายการ
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${todayProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ["work", "งานวันนี้"],
            ["overview", "ภาพรวม"],
            ["ondemand", "ค้นหารหัส"],
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

      {tab === "work" ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="batch-count">จะตรวจกี่ชิ้น</Label>
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
              <Label htmlFor="loc-filter">โซนที่เก็บ (ถ้ามี)</Label>
              <Input
                id="loc-filter"
                className="w-[200px]"
                placeholder="เช่น 1F"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => void createBatch()}
              disabled={creatingBatch}
              className="gap-1.5 bg-teal-700 hover:bg-teal-800"
            >
              {creatingBatch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              สร้างรายการให้ฉัน
            </Button>
            {overview?.open_batches?.length ? (
              <p className="text-xs text-muted-foreground sm:ml-auto">
                ค้างในชุดเปิด{" "}
                {formatCount(
                  overview.open_batches.reduce(
                    (n, b) => n + b.pending_count,
                    0
                  )
                )}{" "}
                ชิ้น
              </p>
            ) : null}
          </div>

          {batchLoading && !activeBatch ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : activeBatch ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">
                  {activeBatch.status === "open" ? "กำลังทำ" : "เสร็จชุดนี้"}
                </Badge>
                <span className="text-muted-foreground">
                  เหลือ {formatCount(activeBatch.pending_count)} · เสร็จ{" "}
                  {formatCount(activeBatch.done_count)}
                  {activeBatch.skipped_count > 0
                    ? ` · ข้าม ${formatCount(activeBatch.skipped_count)}`
                    : ""}
                </span>
              </div>

              {pendingItems.length === 0 ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                  ชุดนี้ทำครบแล้ว — สร้างรายการใหม่ได้เลย หรือดูภาพรวม
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                  {pendingItems.map((item) => {
                    const open = expandedBcode === item.bcode;
                    return (
                      <li
                        key={item.bcode}
                        className="flex flex-col gap-3 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-mono text-sm font-semibold">
                            {item.bcode}
                          </p>
                          <p className="truncate text-sm text-slate-700">
                            {item.descr || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ที่เก็บ {item.location1 || "—"} · คงเหลือ{" "}
                            {formatCount(item.qty)} · ขาย 30 วัน{" "}
                            {formatCount(item.sell_qty_period)}
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-800"
                            onClick={() =>
                              setExpandedBcode(open ? null : item.bcode)
                            }
                          >
                            {open ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            รายละเอียด
                          </button>
                          {open ? (
                            <p className="text-[11px] text-muted-foreground">
                              ตรวจในแอป:{" "}
                              {item.app_dateaudit || "ยังไม่เคย"}
                              {item.pos_dateaudit
                                ? ` · วันที่ใน POS (อ้างอิง): ${item.pos_dateaudit}`
                                : ""}
                            </p>
                          ) : null}
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
                            className="gap-1 bg-teal-700 hover:bg-teal-800"
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
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center">
              <Target className="mx-auto mb-2 h-8 w-8 text-teal-700" />
              <p className="text-sm font-medium text-slate-800">
                เริ่มจากกด “สร้างรายการให้ฉัน”
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                ระบบจะเลือกสินค้าขายดีที่ยังไม่เคยบันทึกตรวจในแอป
                จัดกลุ่มตามที่เก็บให้เดินนับง่ายขึ้น
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "overview" ? (
        <section className="space-y-5">
          {loading && !overview ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-56 rounded-lg" />
              <Skeleton className="h-56 rounded-lg" />
            </div>
          ) : overview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SalesKpiCard
                  title="วันนี้"
                  value={`${formatCount(todayDone)} / ${formatCount(STOCK_AUDIT_DAILY_TARGET)}`}
                  hint="เป้าแนะนำต่อวัน"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="7 วันนี้"
                  value={formatCount(weekDone)}
                  hint="จำนวนที่กดตรวจแล้ว"
                  icon={<Target className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="ยังไม่เคยตรวจ"
                  value={formatCount(overview.summary.never_count)}
                  hint={`จาก ${formatCount(overview.summary.total)} รหัสที่มีสต็อก`}
                />
                <SalesKpiCard
                  title="สด ≤ 30 วัน"
                  value={formatCount(overview.summary.d30_count)}
                  hint="สุขภาพสต็อกที่ดี"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <StockAuditFreshnessPie overview={overview} />
                <StockAuditDailyChart
                  series={overview.daily_marks}
                  markedToday={todayDone}
                  markedWeek={weekDone}
                />
              </div>

              <div>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">
                  รายการตามสถานะ
                </h2>
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
                          bucket === b.key &&
                            "ring-2 ring-slate-900 ring-offset-1"
                        )}
                      >
                        {b.label} {formatCount(count)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">รหัส</th>
                      <th className="px-3 py-2">ชื่อ</th>
                      <th className="px-3 py-2">ที่เก็บ</th>
                      <th className="px-3 py-2 text-right">คงเหลือ</th>
                      <th className="px-3 py-2 text-right">ขาย 30 วัน</th>
                      <th className="px-3 py-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          ไม่มีรายการในกลุ่มนี้
                        </td>
                      </tr>
                    ) : (
                      overview.rows.map((row) => {
                        const meta = bucketMeta(row.bucket);
                        const open = expandedBcode === `ov-${row.bcode}`;
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
                            <td className="max-w-[220px] px-3 py-2">
                              <div className="truncate">{row.descr || "—"}</div>
                              <button
                                type="button"
                                className="mt-0.5 text-[11px] text-slate-500 hover:text-slate-800"
                                onClick={() =>
                                  setExpandedBcode(
                                    open ? null : `ov-${row.bcode}`
                                  )
                                }
                              >
                                {open ? "ซ่อน" : "รายละเอียด"}
                              </button>
                              {open ? (
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  ตรวจในแอป: {row.app_dateaudit || "ยังไม่เคย"}
                                  {row.pos_dateaudit
                                    ? ` · POS (อ้างอิง): ${row.pos_dateaudit}`
                                    : ""}
                                </div>
                              ) : null}
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

      {tab === "ondemand" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="lookup-bcode">รหัสสินค้า</Label>
              <Input
                id="lookup-bcode"
                className="w-full font-mono sm:w-[240px]"
                value={lookupBcode}
                onChange={(e) => setLookupBcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runLookup();
                }}
                placeholder="สแกนหรือพิมพ์"
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
                    <dt className="text-muted-foreground">ตรวจในแอปล่าสุด</dt>
                    <dd>{lookup.app_dateaudit || "ยังไม่เคย"}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => setShowLookupExtra((v) => !v)}
                >
                  {showLookupExtra ? "ซ่อนรายละเอียด" : "รายละเอียดเพิ่ม"}
                </button>
                {showLookupExtra ? (
                  <p className="text-xs text-muted-foreground">
                    วันที่ใน POS (อ้างอิง): {lookup.pos_dateaudit || "—"}
                    {lookup.app_audited_by
                      ? ` · บันทึกโดย ${lookup.app_audited_by}`
                      : ""}
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="gap-1.5 bg-teal-700 hover:bg-teal-800"
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
              <p className="text-sm text-rose-700">
                ไม่พบรหัสนี้ในสาขา {branch}
              </p>
            )
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
