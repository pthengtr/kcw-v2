"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Loader2,
  Receipt,
  RefreshCcw,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import { buildVatHighlights } from "@/lib/bi/highlights";
import {
  formatBahtCompact,
  formatCount,
  pctChange,
} from "@/lib/bi/sales-format";
import {
  bangkokCurrentMonthIso,
  bangkokTodayIso,
  formatThaiDateRange,
  preferDailyBreakdown,
  periodLabel,
  resolvePeriodRange,
} from "@/lib/bi/sales-periods";
import type { BiCustomDateMode, BiPeriodPreset } from "@/lib/bi/sales-types";
import type { BiVatBranchFilter, BiVatOverview } from "@/lib/bi/vat-types";
import { cn } from "@/lib/utils";
import BiHighlightsCard from "@/components/bi/BiHighlightsCard";
import BiLoadingBody from "@/components/bi/BiLoadingBody";
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

import VatBranchTable from "./VatBranchTable";
import VatDocTable from "./VatDocTable";
import VatForecastCard from "./VatForecastCard";
import VatSalesDocChart from "./VatSalesDocChart";
import VatTrendChart from "./VatTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

/** Full calendar end (not capped at today) so mid-period VAT forecast can extrapolate. */
function resolveVatPeriodRange(
  preset: BiPeriodPreset,
  customFrom: string,
  customTo: string,
  customMode: BiCustomDateMode,
  customMonth: string
): { from: string; to: string } {
  const today = bangkokTodayIso();

  if (preset === "month") {
    const monthIso = today.slice(0, 7);
    const year = Number(monthIso.slice(0, 4));
    const month = Number(monthIso.slice(5, 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: `${monthIso}-01`,
      to: `${monthIso}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  if (preset === "ytd") {
    const year = Number(today.slice(0, 4));
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }

  if (customMode === "month") {
    const monthIso = customMonth || bangkokCurrentMonthIso();
    const match = /^(\d{4})-(\d{2})$/.exec(monthIso);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return {
        from: `${match[1]}-${match[2]}-01`,
        to: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
      };
    }
  }

  return resolvePeriodRange(
    preset,
    customFrom,
    customTo,
    new Date(),
    customMode,
    customMonth
  );
}

export default function VatOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [branch, setBranch] = useState<BiVatBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiVatOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(
    () =>
      resolveVatPeriodRange(
        preset,
        customFrom,
        customTo,
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
      });
      if (branch !== "ALL") params.set("branch", branch);

      const res = await fetch(`/api/bi/vat/overview?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiVatOverview;
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

  const useDaily = preferDailyBreakdown(range.from, range.to);
  const trendRows = overview
    ? useDaily
      ? overview.trend_daily
      : overview.trend_monthly
    : [];

  const salesDelta = overview
    ? pctChange(overview.summary.sales_vat, overview.previous_summary.sales_vat)
    : null;
  const purchaseDelta = overview
    ? pctChange(
        overview.summary.purchase_vat,
        overview.previous_summary.purchase_vat
      )
    : null;
  const expenseDelta = overview
    ? pctChange(
        overview.summary.expense_vat,
        overview.previous_summary.expense_vat
      )
    : null;
  const netDelta = overview
    ? pctChange(overview.summary.net_vat, overview.previous_summary.net_vat)
    : null;

  const highlightLines = useMemo(
    () => (overview ? buildVatHighlights(overview) : []),
    [overview]
  );

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              รายงานภาษีขาย / ภาษีซื้อ
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ตาม logic รายงาน VAT ของ kcw-analytics (TD/TAD/TR/CN + TAR/CNTAR ·
              PIDET · ค่าใช้จ่าย) · พยากรณ์สิ้นงวดเมื่อยังไม่ครบเดือน
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ช่วงเวลา</Label>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={preset === p ? "default" : "outline"}
                  className={cn("h-8", preset === p && "shadow-sm")}
                  onClick={() => setPreset(p)}
                  disabled={loading}
                >
                  {periodLabel(p)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">สาขา</Label>
            <Select
              value={branch}
              onValueChange={(v) => setBranch(v as BiVatBranchFilter)}
              disabled={loading}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกสาขา</SelectItem>
                <SelectItem value="HQ">สำนักงานใหญ่</SelectItem>
                <SelectItem value="SYP">สี่แยกพัฒนา</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">โหมดวันที่</Label>
                <Select
                  value={customMode}
                  onValueChange={(v) => setCustomMode(v as BiCustomDateMode)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">วันเดียว</SelectItem>
                    <SelectItem value="month">ทั้งเดือน</SelectItem>
                    <SelectItem value="range">ช่วงวันที่</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {customMode === "month" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">เดือน</Label>
                  <input
                    type="month"
                    value={customMonth}
                    onChange={(e) => setCustomMonth(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs text-muted-foreground">
                    {customMode === "range" ? "จาก – ถึง" : "วันที่"}
                  </Label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                    {customMode === "range" ? (
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading && !overview ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 py-16 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-sky-700" aria-hidden />
          <p className="text-sm text-muted-foreground">กำลังโหลดรายงานภาษี…</p>
          <div className="mt-2 grid w-full max-w-3xl gap-3 px-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      ) : overview ? (
        <BiLoadingBody loading={loading}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SalesKpiCard
                title="ภาษีขาย"
                value={formatBahtCompact(overview.summary.sales_vat)}
                deltaPct={salesDelta}
                hint={`${formatCount(overview.summary.sales_bill_count)} บิล · มูลค่า ${formatBahtCompact(overview.summary.sales_before)}`}
                icon={<Receipt className="h-4 w-4" />}
              />
              <SalesKpiCard
                title="ภาษีซื้อ (สินค้า)"
                value={formatBahtCompact(overview.summary.purchase_vat)}
                deltaPct={purchaseDelta}
                hint={`${formatCount(overview.summary.purchase_bill_count)} บิล · มูลค่า ${formatBahtCompact(overview.summary.purchase_before)}`}
                icon={<ShoppingCart className="h-4 w-4" />}
              />
              <SalesKpiCard
                title="ภาษีซื้อ (ค่าใช้จ่าย)"
                value={formatBahtCompact(overview.summary.expense_vat)}
                deltaPct={expenseDelta}
                hint={`${formatCount(overview.summary.expense_bill_count)} ใบเสร็จ · มูลค่า ${formatBahtCompact(overview.summary.expense_before)}`}
                icon={<Wallet className="h-4 w-4" />}
              />
              <SalesKpiCard
                title="ภาษีสุทธิที่ต้องชำระ"
                value={formatBahtCompact(overview.summary.net_vat)}
                deltaPct={netDelta}
                hint="ภาษีขาย − ภาษีซื้อ − ค่าใช้จ่าย"
                icon={<Calculator className="h-4 w-4" />}
              />
            </div>

            <BiHighlightsCard lines={highlightLines} />

            <div className="grid gap-4 lg:grid-cols-2">
              <VatSalesDocChart
                rows={overview.by_sales_doc}
                totalVat={overview.summary.sales_vat}
                totalBefore={overview.summary.sales_before}
                billCount={overview.summary.sales_bill_count}
              />
              <VatForecastCard
                forecast={overview.forecast}
                summary={overview.summary}
                from={overview.from}
                to={overview.to}
              />
            </div>

            <VatTrendChart
              title={useDaily ? "แนวโน้มรายวัน" : "แนวโน้มรายเดือน (12 เดือน)"}
              rows={trendRows}
              mode={useDaily ? "daily" : "monthly"}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <VatDocTable
                title="ภาษีขายตามประเภทเอกสาร (รายสาขา)"
                rows={overview.by_sales_doc}
                showBranch
              />
              <VatDocTable
                title="ภาษีซื้อตามสมุด (BOOKNO)"
                rows={overview.by_purchase_book}
                emptyText="ไม่มีภาษีซื้อสินค้า (หรือเลือกสาขา SYP — สินค้าซื้อที่ HQ เท่านั้น)"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <VatDocTable
                title="ภาษีซื้อจากค่าใช้จ่ายแอป"
                rows={overview.by_expense_doc}
                showBranch
              />
              <VatBranchTable rows={overview.by_branch} />
            </div>
        </BiLoadingBody>
      ) : null}
    </div>
  );
}
