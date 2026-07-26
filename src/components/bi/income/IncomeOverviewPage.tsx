"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Loader2,
  Package,
  Percent,
  RefreshCcw,
  Wallet,
} from "lucide-react";

import { buildIncomeHighlights } from "@/lib/bi/highlights";
import type { BiIncomeOverview } from "@/lib/bi/income-types";
import { formatBaht, formatCount, pctChange } from "@/lib/bi/sales-format";
import {
  bangkokCurrentMonthIso,
  bangkokTodayIso,
  formatThaiDateRange,
  preferDailyBreakdown,
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

import IncomeBlankCostDialog from "./IncomeBlankCostDialog";
import IncomeBranchTable from "./IncomeBranchTable";
import IncomeOpexTable from "./IncomeOpexTable";
import IncomeTrendChart from "./IncomeTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

function formatMarginPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export default function IncomeOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [branch, setBranch] = useState<BiBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiIncomeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blankCostOpen, setBlankCostOpen] = useState(false);

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
      });
      if (branch !== "ALL") params.set("branch", branch);

      const res = await fetch(`/api/bi/income/overview?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiIncomeOverview;
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

  const grossDelta = overview
    ? pctChange(
        overview.summary.gross_profit,
        overview.previous_summary.gross_profit
      )
    : null;
  const netDelta = overview
    ? pctChange(
        overview.summary.net_income,
        overview.previous_summary.net_income
      )
    : null;
  const revenueDelta = overview
    ? pctChange(
        overview.summary.revenue_net,
        overview.previous_summary.revenue_net
      )
    : null;
  const opexDelta = overview
    ? pctChange(overview.summary.opex, overview.previous_summary.opex)
    : null;

  const highlightLines = useMemo(
    () => (overview ? buildIncomeHighlights(overview) : []),
    [overview]
  );

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              กำไรขั้นต้น / สุทธิ
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ยอดขายก่อน VAT − ต้นทุนซื้อล่าสุด − ค่าใช้จ่ายแอป · ประมาณการ
              (ไม่ใช่งบบัญชีเต็ม)
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
              <Label htmlFor="bi-income-branch">สาขา</Label>
              <Select
                value={branch}
                onValueChange={(v) => setBranch(v as BiBranchFilter)}
              >
                <SelectTrigger id="bi-income-branch" className="w-full">
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
                  <Label htmlFor="bi-income-custom-mode">รูปแบบวันที่</Label>
                  <Select
                    value={customMode}
                    onValueChange={(v) =>
                      setCustomMode(v as BiCustomDateMode)
                    }
                  >
                    <SelectTrigger id="bi-income-custom-mode" className="w-full">
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
                    <Label htmlFor="bi-income-month">เดือน</Label>
                    <input
                      id="bi-income-month"
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-income-from">
                        {customMode === "single" ? "วันที่" : "จากวันที่"}
                      </Label>
                      <input
                        id="bi-income-from"
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
                      <div className="space-y-1.5 sm:col-start-1 lg:col-start-auto">
                        <Label htmlFor="bi-income-to">ถึงวันที่</Label>
                        <input
                          id="bi-income-to"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SalesKpiCard
              title="ยอดขายสุทธิ"
              value={formatBaht(overview.summary.revenue_net)}
              deltaPct={revenueDelta}
              hint="ก่อน VAT · หลังจัดสรรส่วนลดบิล"
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="ต้นทุนขาย (COGS)"
              value={formatBaht(overview.summary.cogs)}
              hint={
                overview.summary.blank_cost_line_count > 0 ? (
                  <button
                    type="button"
                    onClick={() => setBlankCostOpen(true)}
                    className="text-left text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
                  >
                    ต้นทุนว่าง{" "}
                    {formatCount(overview.summary.blank_cost_line_count)}{" "}
                    บรรทัด → 0 · ดูรายการ
                  </button>
                ) : (
                  "ไม่มีบรรทัดต้นทุนว่าง"
                )
              }
              icon={<Package className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="กำไรขั้นต้น"
              value={formatBaht(overview.summary.gross_profit)}
              deltaPct={grossDelta}
              hint={`อัตรากำไร ${formatMarginPct(overview.summary.gross_margin_pct)}`}
              icon={<Percent className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="ค่าใช้จ่าย (OpEx)"
              value={formatBaht(overview.summary.opex)}
              deltaPct={opexDelta}
              hint="บริษัท + ทั่วไป"
              icon={<Landmark className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="กำไรสุทธิ (ประมาณ)"
              value={formatBaht(overview.summary.net_income)}
              deltaPct={netDelta}
              hint={`ขั้นต้น − ค่าใช้จ่าย · ${formatMarginPct(overview.summary.net_margin_pct)} ของยอดขาย`}
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="จำนวนบิล / บรรทัด"
              value={`${formatCount(overview.summary.bill_count)} / ${formatCount(overview.summary.line_count)}`}
              hint={
                overview.previous_summary.gross_margin_pct != null
                  ? `ขั้นต้นช่วงก่อน ${formatMarginPct(overview.previous_summary.gross_margin_pct)}`
                  : "เทียบช่วงก่อน"
              }
              icon={<Package className="h-4 w-4" />}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <IncomeTrendChart
                title={
                  useDaily
                    ? "แนวโน้มรายวัน (ขั้นต้น / สุทธิ / ค่าใช้จ่าย)"
                    : "แนวโน้มรายเดือน (ขั้นต้น / สุทธิ / ค่าใช้จ่าย)"
                }
                rows={trendRows}
                mode={useDaily ? "daily" : "monthly"}
              />
            </div>
            <div className="xl:col-span-2">
              <IncomeOpexTable
                rows={overview.opex_by_category}
                totalOpex={overview.summary.opex}
              />
            </div>
          </section>

          <section>
            <IncomeBranchTable rows={overview.by_branch} />
          </section>

          <section>
            <BiHighlightsCard lines={highlightLines} />
          </section>

          <IncomeBlankCostDialog
            open={blankCostOpen}
            onOpenChange={setBlankCostOpen}
            from={range.from}
            to={range.to}
            branch={branch === "ALL" ? null : branch}
            expectedCount={overview.summary.blank_cost_line_count}
          />
        </>
      ) : null}
    </div>
  );
}
