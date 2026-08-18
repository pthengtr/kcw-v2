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

import { buildProductSalesHighlights } from "@/lib/bi/highlights";
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
import BiHighlightsCard from "@/components/bi/BiHighlightsCard";
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

import ProductBcodeSelect from "./ProductBcodeSelect";
import ProductSalesBranchTable from "./ProductSalesBranchTable";
import ProductSalesHistoryTables from "./ProductSalesHistoryTables";
import ProductSalesPeriodTable from "./ProductSalesPeriodTable";
import ProductSalesTrendChart from "./ProductSalesTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

function formatMarginPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
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
  const [selected, setSelected] = useState<BiProductSearchHit | undefined>();
  const [overview, setOverview] = useState<BiProductSalesOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const yearOptions = useMemo(() => bangkokYearOptions(), []);

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
    const initial = (params.get("bcode") ?? "").trim();
    if (!initial) {
      setHydrated(true);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/bi/products/search?${new URLSearchParams({ q: initial, limit: "5" })}`
        );
        const json = (await res.json()) as { products?: BiProductSearchHit[] };
        const hit = (json.products ?? []).find((p) => p.bcode === initial);
        setSelected(
          hit ?? {
            bcode: initial,
            detail: initial,
            brand: null,
            model: null,
            pcode: null,
            mcode: null,
            category_code: initial.slice(0, 2).padStart(2, "0"),
            on_hand_qty: 0,
          }
        );
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (selected?.bcode) url.searchParams.set("bcode", selected.bcode);
    else url.searchParams.delete("bcode");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [selected?.bcode, hydrated]);

  const load = useCallback(async () => {
    if (!selected?.bcode) {
      setOverview(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        bcode: selected.bcode,
        from: range.from,
        to: range.to,
      });
      if (branch !== "ALL") params.set("branch", branch);

      const res = await fetch(`/api/bi/products/sales?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiProductSalesOverview;
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
  }, [selected?.bcode, range.from, range.to, branch]);

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

  const useDaily = preferDailyBreakdown(range.from, range.to);
  const trendRows = overview
    ? useDaily
      ? overview.trend_daily
      : overview.trend_monthly
    : [];
  const revenueDelta = overview
    ? pctChange(
        overview.summary.revenue_net,
        overview.previous_summary.revenue_net
      )
    : null;
  const qtyDelta = overview
    ? pctChange(overview.summary.base_qty, overview.previous_summary.base_qty)
    : null;
  const gpDelta = overview
    ? pctChange(
        overview.summary.gross_profit,
        overview.previous_summary.gross_profit
      )
    : null;
  const highlightLines = useMemo(
    () => (overview ? buildProductSalesHighlights(overview) : []),
    [overview]
  );

  const product = overview?.product;

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              ยอดขายตามสินค้า
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              เลือก SKU แล้วดูยอดขายรายสาขา/รายช่วง · กำไรขั้นต้นจาก
              LAST_PURCHASE_COST · ซื้อเข้า HQ แยกต่างหาก
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
            disabled={loading || !selected}
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
            <Label>สินค้า</Label>
            <ProductBcodeSelect selected={selected} onSelect={setSelected} />
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

      {!selected ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            เลือกสินค้าด้านบนเพื่อดูยอดขาย กำไรขั้นต้น และประวัติซื้อ/ขาย
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

      {loading && selected && !overview ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview && product ? (
        <BiLoadingBody loading={loading}>
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">สินค้า</p>
                <p className="font-semibold text-slate-900">{product.bcode}</p>
                <p className="text-sm text-slate-700">{product.detail}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">หมวด / ชนิด</p>
                <p className="text-sm text-slate-800">
                  {product.category_code} {product.category_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {product.code1_name
                    ? `${product.code1} · ${product.code1_name}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ยี่ห้อ / รุ่น</p>
                <p className="text-sm text-slate-800">
                  {[product.brand, product.model].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  เบอร์แท้ {product.mcode || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">สต็อก / ต้นทุนล่าสุด</p>
                <p className="text-sm text-slate-800">
                  คงเหลือ {formatCount(product.on_hand_qty)} · COSTLAST{" "}
                  {product.costlast == null
                    ? "—"
                    : formatBaht(product.costlast, true)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ขายล่าสุด {product.last_sale_date || "—"} · ซื้อล่าสุด{" "}
                  {product.last_purchase_date || "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SalesKpiCard
              title="ยอดขายสุทธิ"
              value={formatBahtCompact(overview.summary.revenue_net)}
              deltaPct={revenueDelta}
              hint="ระดับบรรทัด · ก่อน VAT"
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="จำนวนขาย"
              value={formatCount(overview.summary.base_qty)}
              deltaPct={qtyDelta}
              hint={`${formatCount(overview.summary.bill_count)} บิล · เฉลี่ย ${formatBaht(overview.summary.avg_unit_price, true)}/หน่วย`}
              icon={<Boxes className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="กำไรขั้นต้น"
              value={formatBahtCompact(overview.summary.gross_profit)}
              deltaPct={gpDelta}
              hint="ยอดที่มี LAST_PURCHASE_COST − ต้นทุนขาย"
              icon={<Percent className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="อัตรากำไรขั้นต้น"
              value={formatMarginPct(overview.summary.gross_margin_pct)}
              hint={
                overview.summary.blank_cost_line_count > 0
                  ? `ตัด ${formatCount(overview.summary.blank_cost_line_count)} บรรทัดไม่มีต้นทุน`
                  : "คิดจากบรรทัดที่มีต้นทุนซื้อล่าสุด"
              }
              icon={<Percent className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="ซื้อเข้าช่วงนี้"
              value={formatCount(overview.purchase.buy_qty)}
              hint={`${formatBaht(overview.purchase.buy_amount_net)} · ${formatCount(overview.purchase.buy_bills)} บิล HQ — ไม่ใช่ COGS`}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="คงเหลือ HQ"
              value={formatCount(product.on_hand_qty)}
              hint="QTYOH2 จาก ICMAS ณ ตอนซิงก์ล่าสุด"
              icon={<Package className="h-4 w-4" />}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <ProductSalesTrendChart
              title={useDaily ? "แนวโน้มรายวันตามสาขา" : "แนวโน้มรายเดือนตามสาขา"}
              rows={trendRows}
              mode={useDaily ? "daily" : "monthly"}
            />
            <ProductSalesBranchTable rows={overview.by_branch} />
          </section>

          <section>
            <ProductSalesPeriodTable
              rows={trendRows}
              mode={useDaily ? "daily" : "monthly"}
            />
          </section>

          <section>
            <ProductSalesHistoryTables
              sales={overview.sales_history}
              purchases={overview.purchase_history}
            />
          </section>

          <section>
            <BiHighlightsCard lines={highlightLines} />
          </section>
        </BiLoadingBody>
      ) : null}
    </div>
  );
}
