"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Loader2,
  Package,
  RefreshCcw,
  Wallet,
} from "lucide-react";

import { buildProductHighlights } from "@/lib/bi/highlights";
import type { BiProductOverview } from "@/lib/bi/product-types";
import {
  formatBahtCompact,
  formatCount,
  pctChange,
} from "@/lib/bi/sales-format";
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
import BiHighlightsCard from "@/components/bi/BiHighlightsCard";
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

import ProductCategoryTable from "./ProductCategoryTable";
import ProductGroupChart from "./ProductGroupChart";
import ProductRankTable from "./ProductRankTable";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

export default function ProductOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [branch, setBranch] = useState<BiBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiProductOverview | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        limit: "50",
      });
      if (branch !== "ALL") params.set("branch", branch);

      const res = await fetch(`/api/bi/products/overview?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiProductOverview;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      }
      if (!json.overview) {
        throw new Error("ไม่มีข้อมูล");
      }
      setOverview(json.overview);
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, branch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (preset !== "custom") return;
    const today = bangkokTodayIso();
    setCustomFrom((prev) => prev || today);
    setCustomTo((prev) => prev || today);
    setCustomMonth((prev) => prev || bangkokCurrentMonthIso());
  }, [preset]);

  const revenueDelta = overview
    ? pctChange(
        overview.summary.revenue_net,
        overview.previous_summary.revenue_net
      )
    : null;
  const skuDelta = overview
    ? pctChange(
        overview.summary.sku_count,
        overview.previous_summary.sku_count
      )
    : null;
  const qtyDelta = overview
    ? pctChange(overview.summary.base_qty, overview.previous_summary.base_qty)
    : null;
  const highlightLines = useMemo(
    () => (overview ? buildProductHighlights(overview) : []),
    [overview]
  );

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              อันดับสินค้า
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ยอดสุทธิระดับบรรทัด (ก่อน VAT) · หมวดจาก BCODE · ชนิดจาก CODE1
            </p>
            <p className="mt-2 text-xs text-slate-600 sm:text-sm">
              ช่วง{" "}
              <span className="font-medium">
                {formatThaiDateRange(range.from, range.to)}
              </span>
              {overview ? (
                <>
                  {" "}
                  · เทียบ{" "}
                  {formatThaiDateRange(
                    overview.previous_from,
                    overview.previous_to
                  )}
                </>
              ) : null}
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

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลา">
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
              <Label htmlFor="bi-product-branch">สาขา</Label>
              <Select
                value={branch}
                onValueChange={(v) => setBranch(v as BiBranchFilter)}
              >
                <SelectTrigger id="bi-product-branch" className="w-full">
                  <SelectValue placeholder="สาขา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกสาขา</SelectItem>
                  <SelectItem value="HQ">HQ</SelectItem>
                  <SelectItem value="SYP">SYP</SelectItem>
                  <SelectItem value="ONLINE">ออนไลน์</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {preset === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-product-custom-mode">รูปแบบวันที่</Label>
                  <Select
                    value={customMode}
                    onValueChange={(v) =>
                      setCustomMode(v as BiCustomDateMode)
                    }
                  >
                    <SelectTrigger id="bi-product-custom-mode" className="w-full">
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
                    <Label htmlFor="bi-product-month">เดือน</Label>
                    <input
                      id="bi-product-month"
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-product-from">
                        {customMode === "single" ? "วันที่" : "จากวันที่"}
                      </Label>
                      <input
                        id="bi-product-from"
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
                      <div className="space-y-1.5 sm:col-start-1">
                        <Label htmlFor="bi-product-to">ถึงวันที่</Label>
                        <input
                          id="bi-product-to"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SalesKpiCard
              title="ยอดขายสุทธิ"
              value={formatBahtCompact(overview.summary.revenue_net)}
              deltaPct={revenueDelta}
              hint="ระดับบรรทัด · ก่อน VAT"
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="จำนวน SKU"
              value={formatCount(overview.summary.sku_count)}
              deltaPct={skuDelta}
              hint="สินค้าที่มีการขาย"
              icon={<Package className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="จำนวนขาย (หน่วยเล็ก)"
              value={formatCount(overview.summary.base_qty)}
              deltaPct={qtyDelta}
              hint="QTY × MTP"
              icon={<Boxes className="h-4 w-4" />}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ProductGroupChart
              title="หมวดสินค้า (KACC9)"
              rows={overview.by_category}
            />
            <ProductGroupChart
              title="ชนิดชิ้นส่วน (CODE1)"
              rows={overview.by_code1}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <ProductCategoryTable rows={overview.by_category} />
            <ProductCategoryTable
              rows={overview.by_code1}
              title="แยกตามชนิดชิ้นส่วน (CODE1)"
            />
          </section>

          <section>
            <ProductRankTable
              rows={overview.top_products}
              totalRevenue={overview.summary.revenue_net}
            />
          </section>

          <section>
            <BiHighlightsCard lines={highlightLines} />
          </section>
        </>
      ) : null}
    </div>
  );
}
