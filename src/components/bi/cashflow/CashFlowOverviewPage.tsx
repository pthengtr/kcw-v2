"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Loader2,
  RefreshCcw,
  Scale,
  Wallet,
} from "lucide-react";

import { buildCashflowHighlights } from "@/lib/bi/highlights";
import type { BiCashflowOverview } from "@/lib/bi/cashflow-types";
import {
  formatBaht,
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

import CashFlowAccountTable from "./CashFlowAccountTable";
import CashFlowCategoryChart from "./CashFlowCategoryChart";
import CashFlowLineTable from "./CashFlowLineTable";
import CashFlowTrendChart from "./CashFlowTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

function bangkokYearOptions(now = new Date()): number[] {
  const current = Number(bangkokTodayIso(now).slice(0, 4));
  const start = 2023;
  const end = Math.max(current, start);
  return Array.from({ length: end - start + 1 }, (_, i) => end - i);
}

export default function CashFlowOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [ytdYear, setYtdYear] = useState(() =>
    Number(bangkokTodayIso().slice(0, 4))
  );
  const [account, setAccount] = useState<string>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiCashflowOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        limit: "30",
      });
      if (account !== "ALL") params.set("account", account);

      const res = await fetch(`/api/bi/cashflow/overview?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiCashflowOverview;
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
  }, [range.from, range.to, account]);

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

  const netDelta = overview
    ? pctChange(overview.summary.net, overview.previous_summary.net)
    : null;
  const inflowDelta = overview
    ? pctChange(overview.summary.inflow, overview.previous_summary.inflow)
    : null;
  const outflowDelta = overview
    ? pctChange(overview.summary.outflow, overview.previous_summary.outflow)
    : null;

  const highlightLines = useMemo(
    () => (overview ? buildCashflowHighlights(overview) : []),
    [overview]
  );

  const accountOptions = overview?.accounts ?? [];
  const useDailyTrend =
    overview != null &&
    inclusiveDaySpan(overview.from, overview.to) <= 45 &&
    overview.trend_daily.length > 0;

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              กระแสเงินสด (ธนาคาร)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              จาก bank statement ที่นำเข้า · นับทุกรายการเงินเข้า–ออกจริง (รวมที่ละเว้นจับคู่)
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
            {preset === "ytd" ? (
              <div className="space-y-1.5">
                <Label htmlFor="bi-cashflow-year">ปี</Label>
                <Select
                  value={String(ytdYear)}
                  onValueChange={(v) => setYtdYear(Number(v))}
                >
                  <SelectTrigger id="bi-cashflow-year" className="w-full">
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
              <Label htmlFor="bi-cashflow-account">บัญชี</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger id="bi-cashflow-account" className="w-full">
                  <SelectValue placeholder="บัญชี" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกบัญชี</SelectItem>
                  {accountOptions.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {preset === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-cashflow-custom-mode">รูปแบบวันที่</Label>
                  <Select
                    value={customMode}
                    onValueChange={(v) =>
                      setCustomMode(v as BiCustomDateMode)
                    }
                  >
                    <SelectTrigger
                      id="bi-cashflow-custom-mode"
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
                    <Label htmlFor="bi-cashflow-month">เดือน</Label>
                    <input
                      id="bi-cashflow-month"
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-cashflow-from">
                        {customMode === "single" ? "วันที่" : "จากวันที่"}
                      </Label>
                      <input
                        id="bi-cashflow-from"
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
                        <Label htmlFor="bi-cashflow-to">ถึงวันที่</Label>
                        <input
                          id="bi-cashflow-to"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <BiLoadingBody loading={loading}>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SalesKpiCard
              title="เงินเข้า"
              value={formatBahtCompact(overview.summary.inflow)}
              deltaPct={inflowDelta}
              hint={`${formatCount(overview.summary.inflow_count)} รายการ`}
              icon={<ArrowDownLeft className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="เงินออก"
              value={formatBahtCompact(overview.summary.outflow)}
              deltaPct={outflowDelta}
              hint={`${formatCount(overview.summary.outflow_count)} รายการ`}
              icon={<ArrowUpRight className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="สุทธิ"
              value={formatBahtCompact(overview.summary.net)}
              deltaPct={netDelta}
              hint={`ไม่รวมโอนใน: ${formatBahtCompact(overview.summary.net_ex_internal)}`}
              icon={<Scale className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="คงเหลือรวม"
              value={formatBahtCompact(overview.summary.ending_balance)}
              hint={`เปิดช่วง ${formatBahtCompact(overview.summary.opening_balance)} · ${formatCount(overview.summary.account_count)} บัญชี`}
              icon={<Wallet className="h-4 w-4" />}
            />
          </section>

          {overview.summary.internal_in > 0 ||
          overview.summary.internal_out > 0 ||
          overview.summary.unclassified_count > 0 ? (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="space-y-1">
                  {overview.summary.internal_in > 0 ||
                  overview.summary.internal_out > 0 ? (
                    <p>
                      โอนระหว่างบัญชีในช่วงนี้: เข้า{" "}
                      {formatBaht(overview.summary.internal_in)} · ออก{" "}
                      {formatBaht(overview.summary.internal_out)} (หักออกจาก
                      “สุทธิไม่รวมโอนใน”)
                    </p>
                  ) : null}
                  {overview.summary.unclassified_count > 0 ? (
                    <p>
                      ยังไม่จับคู่หมวด:{" "}
                      {formatCount(overview.summary.unclassified_count)} รายการ
                      — ยอดเงินยังนับในกระแสเงินสด แต่หมวดอาจไม่ครบ
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <CashFlowTrendChart
              title={useDailyTrend ? "แนวโน้มรายวัน" : "แนวโน้มรายเดือน"}
              rows={
                useDailyTrend
                  ? overview.trend_daily
                  : overview.trend_monthly
              }
              mode={useDailyTrend ? "daily" : "monthly"}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CashFlowCategoryChart
              title="หมวดเงินเข้า"
              rows={overview.by_category}
              direction="inflow"
            />
            <CashFlowCategoryChart
              title="หมวดเงินออก"
              rows={overview.by_category}
              direction="outflow"
            />
          </section>

          <section>
            <CashFlowAccountTable rows={overview.by_account} />
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CashFlowLineTable
              title="เงินเข้าสูงสุด"
              rows={overview.top_inflows}
              tone="in"
            />
            <CashFlowLineTable
              title="เงินออกสูงสุด"
              rows={overview.top_outflows}
              tone="out"
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

function inclusiveDaySpan(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00+07:00`);
  const b = Date.parse(`${to}T00:00:00+07:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}
