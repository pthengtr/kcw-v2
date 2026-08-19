"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Loader2,
  Package,
  Percent,
  RefreshCcw,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import {
  parseProductSalesSelection,
  writeProductSalesSelection,
} from "@/lib/bi/product-filters";
import {
  PRODUCT_SALES_COMPARE_HISTORY_LIMIT,
  PRODUCT_SALES_SINGLE_HISTORY_LIMIT,
  buildCompareRevenueSeries,
  pickFocusedBcode,
  summarizeProductSalesReports,
  toCompareRow,
} from "@/lib/bi/product-sales-compare";
import type {
  BiProductSalesOverview,
  BiProductSearchHit,
} from "@/lib/bi/product-sales-types";
import {
  formatBaht,
  formatBahtCompact,
  formatCount,
  pctChange,
} from "@/lib/bi/sales-format";
import {
  bangkokCurrentMonthIso,
  bangkokTodayIso,
  bangkokYearOptions,
  formatThaiDateRange,
  periodLabel,
  preferDailyBreakdown,
  resolvePeriodRange,
} from "@/lib/bi/sales-periods";
import type {
  BiBranchFilter,
  BiCustomDateMode,
  BiPeriodPreset,
} from "@/lib/bi/sales-types";
import { cn } from "@/lib/utils";
import BiLoadingBody from "@/components/bi/BiLoadingBody";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import ProductBcodeMultiSelect from "./ProductBcodeMultiSelect";
import ProductSalesCompareTable from "./ProductSalesCompareTable";
import ProductSalesCompareTrendChart from "./ProductSalesCompareTrendChart";
import ProductSalesDetail from "./ProductSalesDetail";
import ProductSalesSkuMixPie from "./ProductSalesSkuMixPie";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

function formatMarginPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function stubHit(bcode: string): BiProductSearchHit {
  return {
    bcode,
    detail: bcode,
    brand: null,
    model: null,
    pcode: null,
    mcode: null,
    category_code: bcode.slice(0, 2).padStart(2, "0"),
    on_hand_qty: 0,
  };
}

async function resolveHits(bcodes: string[]): Promise<BiProductSearchHit[]> {
  return Promise.all(
    bcodes.map(async (bcode) => {
      try {
        const res = await fetch(
          `/api/bi/products/search?${new URLSearchParams({ q: bcode, limit: "5" })}`
        );
        const json = (await res.json()) as { products?: BiProductSearchHit[] };
        return (
          (json.products ?? []).find((hit) => hit.bcode === bcode) ??
          stubHit(bcode)
        );
      } catch {
        return stubHit(bcode);
      }
    })
  );
}

export default function ProductSalesPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [ytdYear, setYtdYear] = useState(() =>
    Number(bangkokTodayIso().slice(0, 4))
  );
  const [branch, setBranch] = useState<BiBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [selected, setSelected] = useState<BiProductSearchHit[]>([]);
  const [reports, setReports] = useState<BiProductSalesOverview[]>([]);
  const [focusedBcode, setFocusedBcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const yearOptions = useMemo(() => bangkokYearOptions(), []);
  const selectedBcodes = useMemo(
    () => selected.map((hit) => hit.bcode),
    [selected]
  );
  const selectedKey = selectedBcodes.join(",");
  const isCompare = selected.length > 1;

  const range = useMemo(
    () =>
      resolvePeriodRange(
        preset,
        customFrom,
        customTo,
        new Date(),
        customMode,
        customMonth,
        ytdYear
      ),
    [preset, customFrom, customTo, customMode, customMonth, ytdYear]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = parseProductSalesSelection(params);
    if (!initial.length) {
      setHydrated(true);
      return;
    }
    void (async () => {
      setSelected(await resolveHits(initial));
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    writeProductSalesSelection(url, selectedBcodes);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [selectedBcodes, hydrated]);

  const load = useCallback(async () => {
    if (!selectedBcodes.length) {
      setReports([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const historyLimit = isCompare
        ? PRODUCT_SALES_COMPARE_HISTORY_LIMIT
        : PRODUCT_SALES_SINGLE_HISTORY_LIMIT;
      const settled = await Promise.allSettled(
        selectedBcodes.map(async (bcode) => {
          const params = new URLSearchParams({
            bcode,
            from: range.from,
            to: range.to,
            history_limit: String(historyLimit),
          });
          if (branch !== "ALL") params.set("branch", branch);
          const res = await fetch(`/api/bi/products/sales?${params.toString()}`);
          const json = (await res.json()) as {
            overview?: BiProductSalesOverview;
            error?: string;
          };
          if (!res.ok) {
            throw new Error(json.error || `โหลด ${bcode} ไม่สำเร็จ`);
          }
          if (!json.overview) {
            throw new Error(`ไม่มีข้อมูล ${bcode}`);
          }
          return json.overview;
        })
      );

      const ok: BiProductSalesOverview[] = [];
      const failed: string[] = [];
      settled.forEach((result, index) => {
        if (result.status === "fulfilled") ok.push(result.value);
        else failed.push(selectedBcodes[index] ?? "");
      });
      setReports(ok);
      if (!ok.length) {
        throw new Error("โหลดข้อมูลไม่สำเร็จ");
      }
      if (failed.length) {
        setError(`โหลดไม่ครบ: ${failed.filter(Boolean).join(", ")}`);
      }

      setSelected((prev) => {
        let changed = false;
        const next = prev.map((hit) => {
          const report = ok.find((row) => row.product.bcode === hit.bcode);
          if (!report || hit.detail === report.product.detail) return hit;
          changed = true;
          return {
            ...hit,
            detail: report.product.detail,
            brand: report.product.brand,
            model: report.product.model,
            pcode: report.product.pcode,
            mcode: report.product.mcode,
            category_code: report.product.category_code,
            on_hand_qty: report.product.on_hand_qty,
          };
        });
        return changed ? next : prev;
      });
    } catch (err) {
      setReports([]);
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [selectedKey, isCompare, range.from, range.to, branch]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [load, hydrated]);

  useEffect(() => {
    if (preset !== "custom") return;
    const today = bangkokTodayIso();
    setCustomFrom((prev) => prev || today);
    setCustomTo((prev) => prev || today);
    setCustomMonth((prev) => prev || bangkokCurrentMonthIso());
  }, [preset]);

  const compareRows = useMemo(() => reports.map(toCompareRow), [reports]);
  const totals = useMemo(
    () => (reports.length ? summarizeProductSalesReports(reports) : null),
    [reports]
  );
  const useDaily = preferDailyBreakdown(range.from, range.to);
  const compareSeries = useMemo(
    () =>
      reports.length > 1
        ? buildCompareRevenueSeries(reports, useDaily ? "daily" : "monthly")
        : [],
    [reports, useDaily]
  );
  const effectiveFocus = pickFocusedBcode(reports, focusedBcode);
  const focusedReport =
    reports.find(
      (row) =>
        row.product.bcode === effectiveFocus || row.bcode === effectiveFocus
    ) ?? null;

  const revenueDelta = totals
    ? pctChange(totals.revenue_net, totals.previous_revenue_net)
    : null;
  const qtyDelta = totals
    ? pctChange(totals.base_qty, totals.previous_base_qty)
    : null;
  const gpDelta = totals
    ? pctChange(totals.gross_profit, totals.previous_gross_profit)
    : null;

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              ยอดขายตามสินค้า
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              เลือก SKU ได้หลายตัวเพื่อเทียบยอดขาย · กำไรขั้นต้นจาก
              LAST_PURCHASE_COST · ซื้อเข้า HQ แยกต่างหาก
            </p>
            <p className="mt-2 text-xs text-slate-600 sm:text-sm">
              ช่วง{" "}
              <span className="font-medium">
                {formatThaiDateRange(range.from, range.to)}
              </span>
              {reports[0] ? (
                <>
                  {" "}
                  · เทียบ{" "}
                  {formatThaiDateRange(
                    reports[0].previous_from,
                    reports[0].previous_to
                  )}
                </>
              ) : null}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || selected.length === 0}
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
          <div className="space-y-1.5">
            <Label>สินค้า (เลือกได้หลายตัว)</Label>
            <ProductBcodeMultiSelect
              selected={selected}
              onChange={setSelected}
            />
          </div>

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
            {preset === "ytd" ? (
              <div className="space-y-1.5">
                <Label htmlFor="bi-ps-year">ปี</Label>
                <Select
                  value={String(ytdYear)}
                  onValueChange={(v) => setYtdYear(Number(v))}
                >
                  <SelectTrigger id="bi-ps-year" className="w-full">
                    <SelectValue placeholder="ปี" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year + 543} ({year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="bi-ps-branch">สาขา</Label>
              <Select
                value={branch}
                onValueChange={(v) => setBranch(v as BiBranchFilter)}
              >
                <SelectTrigger id="bi-ps-branch" className="w-full">
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
                  <Label htmlFor="bi-ps-custom-mode">รูปแบบวันที่</Label>
                  <Select
                    value={customMode}
                    onValueChange={(v) => setCustomMode(v as BiCustomDateMode)}
                  >
                    <SelectTrigger id="bi-ps-custom-mode" className="w-full">
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
                    <Label htmlFor="bi-ps-month">เดือน</Label>
                    <input
                      id="bi-ps-month"
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-ps-from">
                        {customMode === "single" ? "วันที่" : "จากวันที่"}
                      </Label>
                      <input
                        id="bi-ps-from"
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
                        <Label htmlFor="bi-ps-to">ถึงวันที่</Label>
                        <input
                          id="bi-ps-to"
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

      {!selected.length ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            เลือกสินค้าด้านบน — ได้หลายตัวเพื่อเทียบยอดขายและมาร์จิ้น
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}

      {loading && selected.length > 0 && reports.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {isCompare && totals ? (
        <BiLoadingBody loading={loading}>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SalesKpiCard
              title="ยอดขายรวม"
              value={formatBahtCompact(totals.revenue_net)}
              deltaPct={revenueDelta}
              hint={`${totals.soldSkuCount} มียอดขายจาก ${totals.skuCount} ที่เลือก`}
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="จำนวนขายรวม"
              value={formatCount(totals.base_qty)}
              deltaPct={qtyDelta}
              hint="รวมตาม SKU ที่เลือก"
              icon={<Boxes className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="กำไรขั้นต้นรวม"
              value={formatBahtCompact(totals.gross_profit)}
              deltaPct={gpDelta}
              hint="ยอดที่มี LAST_PURCHASE_COST − ต้นทุนขาย"
              icon={<Percent className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="มาร์จิ้นรวม"
              value={formatMarginPct(totals.gross_margin_pct)}
              hint={
                totals.blank_cost_line_count > 0
                  ? `ตัด ${formatCount(totals.blank_cost_line_count)} บรรทัดไม่มีต้นทุน`
                  : "คิดจากบรรทัดที่มีต้นทุนซื้อล่าสุด"
              }
              icon={<Percent className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="ซื้อเข้าช่วงนี้"
              value={formatCount(totals.buy_qty)}
              hint={`${formatBaht(totals.buy_amount_net)} · ${formatCount(totals.buy_bills)} บิล HQ — ไม่ใช่ COGS`}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="คงเหลือ HQ"
              value={formatCount(totals.on_hand_qty)}
              hint="รวม QTYOH2 ของ SKU ที่เลือก"
              icon={<Package className="h-4 w-4" />}
            />
          </section>

          <ProductSalesCompareTable
            rows={compareRows}
            focusedBcode={effectiveFocus}
            onFocus={setFocusedBcode}
          />

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <ProductSalesCompareTrendChart
              title={
                useDaily
                  ? "แนวโน้มยอดขายรายวันตามสินค้า"
                  : "แนวโน้มยอดขายรายเดือนตามสินค้า"
              }
              rows={compareSeries}
              skus={compareRows}
              mode={useDaily ? "daily" : "monthly"}
            />
            <ProductSalesSkuMixPie rows={compareRows} />
          </section>
        </BiLoadingBody>
      ) : null}

      {focusedReport ? (
        <div className="space-y-3">
          {isCompare ? (
            <h2 className="text-sm font-semibold text-slate-800">
              รายละเอียด · {focusedReport.product.bcode}{" "}
              <span className="font-normal text-muted-foreground">
                {focusedReport.product.detail}
              </span>
            </h2>
          ) : null}
          <ProductSalesDetail
            overview={focusedReport}
            loading={loading && !isCompare}
            branchFilter={branch}
          />
        </div>
      ) : null}
    </div>
  );
}
