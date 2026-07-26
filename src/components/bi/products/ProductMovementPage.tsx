"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Package,
  RefreshCcw,
  ShoppingCart,
} from "lucide-react";

import type {
  BiDeadSort,
  BiDeadTier,
  BiProductMovement,
} from "@/lib/bi/product-movement-types";
import { formatBahtCompact, formatCount } from "@/lib/bi/sales-format";
import {
  bangkokCurrentMonthIso,
  bangkokTodayIso,
  formatThaiDateRange,
  periodLabel,
  resolvePeriodRange,
} from "@/lib/bi/sales-periods";
import type {
  BiBranchFilter,
  BiCustomDateMode,
  BiPeriodPreset,
} from "@/lib/bi/sales-types";
import { cn } from "@/lib/utils";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import DeadStockTable from "./DeadStockTable";
import StockMoreTable from "./StockMoreTable";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];
const DEAD_PAGE_SIZE = 100;

type TabId = "stock-more" | "dead";

export default function ProductMovementPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [branch, setBranch] = useState<BiBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [tab, setTab] = useState<TabId>("dead");
  const [deadAsOf, setDeadAsOf] = useState(() => bangkokTodayIso());
  const [deadSort, setDeadSort] = useState<BiDeadSort>("value_desc");
  const [deadTier, setDeadTier] = useState<BiDeadTier | "ALL">("ALL");
  const [deadCategory, setDeadCategory] = useState<string | null>(null);
  const [deadOffset, setDeadOffset] = useState(0);
  const [overview, setOverview] = useState<BiProductMovement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(
    () =>
      resolvePeriodRange(
        preset,
        customFrom,
        customTo,
        new Date(),
        customMode,
        customMonth
      ),
    [preset, customFrom, customTo, customMode, customMonth]
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        stock_limit: "50",
        dead_limit: String(DEAD_PAGE_SIZE),
        dead_offset: String(deadOffset),
        dead_sort: deadSort,
        mode: tab === "dead" ? "dead" : "stock_more",
      });

      if (tab === "dead") {
        // Dead stock is as-of date only — period/branch filters do not apply.
        params.set("from", deadAsOf);
        params.set("to", deadAsOf);
        if (deadTier !== "ALL") params.set("dead_tier", deadTier);
        if (deadCategory) params.set("category", deadCategory);
      } else {
        params.set("from", range.from);
        params.set("to", range.to);
        if (branch !== "ALL") params.set("branch", branch);
      }

      const res = await fetch(
        `/api/bi/products/movement?${params.toString()}`,
        { signal }
      );
      const json = (await res.json()) as {
        overview?: BiProductMovement;
        error?: string;
      };
      if (signal?.aborted) return;
      if (!res.ok) {
        throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      }
      if (!json.overview) {
        throw new Error("ไม่มีข้อมูล");
      }
      setOverview(json.overview);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      setOverview(null);
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [
    tab,
    range.from,
    range.to,
    branch,
    deadAsOf,
    deadSort,
    deadTier,
    deadCategory,
    deadOffset,
  ]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Reset paging without a second concurrent request when filters change.
  const setDeadSortAndReset = useCallback((next: BiDeadSort) => {
    setDeadOffset(0);
    setDeadSort(next);
  }, []);

  const setDeadTierAndReset = useCallback((next: BiDeadTier | "ALL") => {
    setDeadOffset(0);
    setDeadTier(next);
  }, []);

  const setDeadCategoryAndReset = useCallback((next: string | null) => {
    setDeadOffset(0);
    setDeadCategory(next);
  }, []);

  const setDeadAsOfAndReset = useCallback((next: string) => {
    setDeadOffset(0);
    setDeadAsOf(next);
  }, []);

  const setTabAndReset = useCallback((next: TabId) => {
    setDeadOffset(0);
    setTab(next);
  }, []);

  useEffect(() => {
    if (preset !== "custom") return;
    const today = bangkokTodayIso();
    setCustomFrom((prev) => prev || today);
    setCustomTo((prev) => prev || today);
    setCustomMonth((prev) => prev || bangkokCurrentMonthIso());
  }, [preset]);

  const onDeadPrev = useCallback(() => {
    setDeadOffset((prev) => Math.max(0, prev - DEAD_PAGE_SIZE));
  }, []);

  const onDeadNext = useCallback(() => {
    setDeadOffset((prev) => prev + DEAD_PAGE_SIZE);
  }, []);

  const onDeadJumpPage = useCallback((page: number) => {
    setDeadOffset(Math.max(0, (page - 1) * DEAD_PAGE_SIZE));
  }, []);

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              การเคลื่อนไหวสินค้า
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ขายบ่อย → สต็อกเพิ่ม · สต็อกค้างนับจากวันซื้อล่าสุดที่ยังไม่ขาย
              (เหลือง ≥6 ด. / ส้ม ≥1 ปี / แดง ≥2 ปี) · ซื้ออ้างอิง HQ เสมอ
            </p>
            <p className="mt-2 text-xs text-slate-600 sm:text-sm">
              {tab === "dead" ? (
                <>
                  สต็อกค้างนับถึง{" "}
                  <span className="font-medium">
                    {formatThaiDateRange(deadAsOf, deadAsOf)}
                  </span>
                  {" "}
                  · ไม่กรองช่วงขาย/สาขา
                </>
              ) : (
                <>
                  ช่วง{" "}
                  <span className="font-medium">
                    {formatThaiDateRange(range.from, range.to)}
                  </span>
                  {branch !== "ALL" ? (
                    <>
                      {" "}
                      · ขายกรองสาขา{" "}
                      <span className="font-medium">{branch}</span>
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="self-start"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            รีเฟรช
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "dead" ? "default" : "outline"}
            className={cn(tab === "dead" && "bg-slate-800 hover:bg-slate-700")}
            onClick={() => setTabAndReset("dead")}
          >
            ระวังก่อนสั่ง / สต็อกค้าง
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "stock-more" ? "default" : "outline"}
            className={cn(
              tab === "stock-more" && "bg-slate-800 hover:bg-slate-700"
            )}
            onClick={() => setTabAndReset("stock-more")}
          >
            ควรสต็อกเพิ่ม
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {tab === "stock-more" ? (
            <>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="ช่วงเวลา"
              >
                {PERIODS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={preset === p ? "default" : "outline"}
                    className={cn(
                      preset === p && "bg-slate-800 hover:bg-slate-700"
                    )}
                    onClick={() => setPreset(p)}
                  >
                    {periodLabel(p)}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bi-move-branch">สาขาขาย</Label>
                  <Select
                    value={branch}
                    onValueChange={(v) => setBranch(v as BiBranchFilter)}
                  >
                    <SelectTrigger id="bi-move-branch" className="w-full">
                      <SelectValue placeholder="สาขา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทุกสาขา (ขาย)</SelectItem>
                      <SelectItem value="HQ">HQ</SelectItem>
                      <SelectItem value="SYP">SYP</SelectItem>
                      <SelectItem value="ONLINE">ออนไลน์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {preset === "custom" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-move-custom-mode">รูปแบบวันที่</Label>
                      <Select
                        value={customMode}
                        onValueChange={(v) =>
                          setCustomMode(v as BiCustomDateMode)
                        }
                      >
                        <SelectTrigger
                          id="bi-move-custom-mode"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">วันเดียว</SelectItem>
                          <SelectItem value="month">เดือน</SelectItem>
                          <SelectItem value="range">ช่วงวันที่</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {customMode === "month" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="bi-move-month">เดือน</Label>
                        <input
                          id="bi-move-month"
                          type="month"
                          value={customMonth}
                          onChange={(e) => setCustomMonth(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="bi-move-from">
                            {customMode === "single" ? "วันที่" : "จากวันที่"}
                          </Label>
                          <input
                            id="bi-move-from"
                            type="date"
                            value={customFrom}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCustomFrom(value);
                              if (customMode === "single") setCustomTo(value);
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                        {customMode === "range" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="bi-move-to">ถึงวันที่</Label>
                            <input
                              id="bi-move-to"
                              type="date"
                              value={customTo}
                              onChange={(e) => setCustomTo(e.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                          </div>
                        ) : null}
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="grid max-w-sm grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bi-dead-asof">นับสต็อกค้างถึงวันที่</Label>
                <input
                  id="bi-dead-asof"
                  type="date"
                  value={deadAsOf}
                  onChange={(e) => setDeadAsOfAndReset(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  ช่วงเดือน/YTD และสาขาขายใช้กับตาราง “ควรสต็อกเพิ่ม” เท่านั้น
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          <section
            className={cn(
              "grid grid-cols-1 gap-3",
              tab === "dead"
                ? "sm:grid-cols-2 xl:grid-cols-3"
                : "sm:grid-cols-2 xl:grid-cols-3"
            )}
          >
            {tab === "stock-more" ? (
              <>
                <SalesKpiCard
                  title="SKU ที่ขาย"
                  value={formatCount(overview.summary.sold_sku_count)}
                  hint={`ปริมาณ ${formatCount(overview.summary.sell_qty)}`}
                  icon={<Package className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="SKU ที่ซื้อ (HQ)"
                  value={formatCount(overview.summary.bought_sku_count)}
                  hint={`ปริมาณ ${formatCount(overview.summary.buy_qty)}`}
                  icon={<ShoppingCart className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="อันดับขายออก"
                  value={formatCount(overview.stock_more.length)}
                  hint="รายการในตาราง Stock more"
                  icon={<ArrowUpRight className="h-4 w-4" />}
                />
              </>
            ) : (
              <>
                <SalesKpiCard
                  title="รายการตามตัวกรอง"
                  value={formatCount(overview.summary.dead_total_count)}
                  hint={`ในหมวด ${formatCount(overview.summary.dead_category_total)} รายการ`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="มูลค่าตามตัวกรอง"
                  value={formatBahtCompact(overview.summary.dead_stock_value)}
                  hint={`ทั้งหมวด ${formatBahtCompact(overview.summary.dead_category_stock_value)}`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="แดง / ส้ม / เหลือง"
                  value={`${formatCount(overview.summary.dead_red_count)} / ${formatCount(overview.summary.dead_orange_count)} / ${formatCount(overview.summary.dead_yellow_count)}`}
                  hint="นับในหมวดที่เลือก (ทุกระดับ)"
                  icon={<AlertTriangle className="h-4 w-4" />}
                />
              </>
            )}
          </section>

          {tab === "stock-more" ? (
            <StockMoreTable rows={overview.stock_more} />
          ) : (
            <DeadStockTable
              rows={overview.dead_stock}
              totalCount={overview.summary.dead_total_count}
              categoryTotal={overview.summary.dead_category_total}
              stockValue={overview.summary.dead_stock_value}
              categoryStockValue={overview.summary.dead_category_stock_value}
              tierCounts={{
                yellow: overview.summary.dead_yellow_count,
                orange: overview.summary.dead_orange_count,
                red: overview.summary.dead_red_count,
              }}
              offset={overview.dead_offset}
              pageSize={overview.dead_limit || DEAD_PAGE_SIZE}
              hasMore={overview.dead_has_more}
              sort={deadSort}
              tierFilter={deadTier}
              category={deadCategory}
              loading={loading}
              onSortChange={setDeadSortAndReset}
              onTierChange={setDeadTierAndReset}
              onCategoryChange={setDeadCategoryAndReset}
              onPrev={onDeadPrev}
              onNext={onDeadNext}
              onJumpPage={onDeadJumpPage}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
