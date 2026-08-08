"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Landmark,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { buildIncomeStatementHighlights } from "@/lib/bi/highlights";
import type {
  BiIncomeStatementBranchFilter,
  BiIncomeStatementOverview,
} from "@/lib/bi/income-statement-types";
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

import IncomeStatementBranchTable from "./IncomeStatementBranchTable";
import IncomeStatementForecastCard from "./IncomeStatementForecastCard";
import IncomeStatementTable from "./IncomeStatementTable";
import IncomeStatementTrendChart from "./IncomeStatementTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

/** Full calendar end so mid-period / YTD forecast can extrapolate to period end. */
function resolveIncomeStatementPeriodRange(
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

function formatMarginPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export default function IncomeStatementOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("ytd");
  const [branch, setBranch] = useState<BiIncomeStatementBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiIncomeStatementOverview | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(
    () =>
      resolveIncomeStatementPeriodRange(
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

      const res = await fetch(
        `/api/bi/income-statement/overview?${params.toString()}`
      );
      const json = (await res.json()) as {
        overview?: BiIncomeStatementOverview;
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

  const revenueDelta = overview
    ? pctChange(overview.summary.revenue, overview.previous_summary.revenue)
    : null;
  const profitDelta = overview
    ? pctChange(
        overview.summary.profit_before_tax,
        overview.previous_summary.profit_before_tax
      )
    : null;
  const taxDelta = overview
    ? pctChange(
        overview.summary.income_tax,
        overview.previous_summary.income_tax
      )
    : null;
  const netDelta = overview
    ? pctChange(
        overview.summary.net_profit,
        overview.previous_summary.net_profit
      )
    : null;

  const highlightLines = useMemo(
    () => (overview ? buildIncomeStatementHighlights(overview) : []),
    [overview]
  );

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              กำไรขาดทุน (เฉพาะส่งบัญชี)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              เฉพาะยอดจากสมุดภาษีขาย/ซื้อ (ไม่รวมขายไม่มี VAT) · ประมาณการภาษีเงินได้{" "}
              {(overview?.cit_rate ?? 0.2) * 100}% · พยากรณ์สิ้นงวด/สิ้นปี ·
              ภาพรวมทั้งกิจการอยู่ที่ กำไรขาดทุน (ทั้งกิจการ)
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
                  {overview.as_of ? <> · ข้อมูลถึง {overview.as_of}</> : null}
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
              onValueChange={(v) =>
                setBranch(v as BiIncomeStatementBranchFilter)
              }
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
          <p className="text-sm text-muted-foreground">
            กำลังโหลดงบกำไรขาดทุน…
          </p>
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
              title="รายได้ (ภาษีขาย)"
              value={formatBahtCompact(overview.summary.revenue)}
              deltaPct={revenueDelta}
              hint={`${formatCount(overview.summary.sales_bill_count)} บิล · ก่อน VAT`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="กำไรก่อนภาษี"
              value={formatBahtCompact(overview.summary.profit_before_tax)}
              deltaPct={profitDelta}
              hint={`มาร์จิน ${formatMarginPct(overview.summary.profit_margin_pct)} · ต้นทุนรวม ${formatBahtCompact(overview.summary.total_cost)}`}
              icon={<Landmark className="h-4 w-4" />}
            />
            <SalesKpiCard
              title={`ภาษีเงินได้ (${(overview.cit_rate * 100).toFixed(0)}%)`}
              value={formatBahtCompact(overview.summary.income_tax)}
              deltaPct={taxDelta}
              hint="ประมาณการจากกำไรก่อนภาษี (ขาดทุน = 0)"
              icon={<Calculator className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="กำไรสุทธิหลังภาษี"
              value={formatBahtCompact(overview.summary.net_profit)}
              deltaPct={netDelta}
              hint={`มาร์จิน ${formatMarginPct(overview.summary.net_margin_pct)}`}
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>

          <BiHighlightsCard lines={highlightLines} />

          <div className="grid gap-4 lg:grid-cols-2">
            <IncomeStatementTable
              summary={overview.summary}
              citRate={overview.cit_rate}
            />
            <IncomeStatementForecastCard
              forecast={overview.forecast}
              summary={overview.summary}
              from={overview.from}
              to={overview.to}
              citRate={overview.cit_rate}
            />
          </div>

          <IncomeStatementTrendChart
            title={useDaily ? "แนวโน้มรายวัน" : "แนวโน้มรายเดือน (12 เดือน)"}
            rows={trendRows}
            mode={useDaily ? "daily" : "monthly"}
          />

          <IncomeStatementBranchTable rows={overview.by_branch} />
        </BiLoadingBody>
      ) : null}
    </div>
  );
}
