"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Layers3,
  Loader2,
  Receipt,
  RefreshCcw,
  Users,
  Wallet,
} from "lucide-react";

import { buildExpenseHighlights } from "@/lib/bi/highlights";
import type {
  BiExpenseOverview,
  BiExpenseSourceFilter,
} from "@/lib/bi/expense-types";
import { formatBaht, formatCount, pctChange } from "@/lib/bi/sales-format";
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

import ExpenseGroupChart from "./ExpenseGroupChart";
import ExpenseItemTable from "./ExpenseItemTable";
import ExpenseTrendChart from "./ExpenseTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

const SOURCE_LABEL: Record<BiExpenseSourceFilter, string> = {
  ALL: "ทั้งหมด",
  ENTRIES: "บริษัท",
  GENERAL: "ทั่วไป",
};

export default function ExpenseOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [branch, setBranch] = useState<string>("ALL");
  const [source, setSource] = useState<BiExpenseSourceFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiExpenseOverview | null>(null);
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
        limit: "30",
      });
      if (branch !== "ALL") params.set("branch", branch);
      if (source !== "ALL") params.set("source", source);

      const res = await fetch(`/api/bi/expenses/overview?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiExpenseOverview;
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
  }, [range.from, range.to, branch, source]);

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

  const amountDelta = overview
    ? pctChange(overview.summary.amount, overview.previous_summary.amount)
    : null;
  const itemDelta = overview
    ? pctChange(
        overview.summary.item_count,
        overview.previous_summary.item_count
      )
    : null;
  const highlightLines = useMemo(
    () => (overview ? buildExpenseHighlights(overview) : []),
    [overview]
  );

  const sourceChartRows = useMemo(() => {
    if (!overview) return [];
    return overview.by_source.map((row) => ({
      key: row.key,
      label: row.key === "ENTRIES" ? "บริษัท" : "ทั่วไป",
      amount: row.amount,
    }));
  }, [overview]);

  const categoryChartRows = useMemo(() => {
    if (!overview) return [];
    return overview.by_category.map((row) => ({
      key: row.key,
      label: row.label,
      amount: row.amount,
    }));
  }, [overview]);

  const branchOptions = overview?.branches ?? [];

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              ภาพรวมค่าใช้จ่าย
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              จากแอปค่าใช้จ่าย · บริษัท + ทั่วไป · สูตรเดียวกับ /expense/dashboard
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
              <Label htmlFor="bi-expense-branch">สาขา</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger id="bi-expense-branch" className="w-full">
                  <SelectValue placeholder="สาขา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกสาขา</SelectItem>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.key} value={b.key}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bi-expense-source">แหล่งข้อมูล</Label>
              <Select
                value={source}
                onValueChange={(v) => setSource(v as BiExpenseSourceFilter)}
              >
                <SelectTrigger id="bi-expense-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABEL) as BiExpenseSourceFilter[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {SOURCE_LABEL[key]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {preset === "custom" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-expense-custom-mode">รูปแบบวันที่</Label>
                  <Select
                    value={customMode}
                    onValueChange={(v) =>
                      setCustomMode(v as BiCustomDateMode)
                    }
                  >
                    <SelectTrigger
                      id="bi-expense-custom-mode"
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
                    <Label htmlFor="bi-expense-month">เดือน</Label>
                    <input
                      id="bi-expense-month"
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-expense-from">
                        {customMode === "single" ? "วันที่" : "จากวันที่"}
                      </Label>
                      <input
                        id="bi-expense-from"
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
                        <Label htmlFor="bi-expense-to">ถึงวันที่</Label>
                        <input
                          id="bi-expense-to"
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
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SalesKpiCard
              title="ยอดค่าใช้จ่าย"
              value={formatBaht(overview.summary.amount)}
              deltaPct={amountDelta}
              hint={`${SOURCE_LABEL[source]} · เทียบช่วงก่อน`}
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="บริษัท"
              value={formatBaht(overview.summary.entries_amount)}
              hint={`${formatCount(overview.summary.receipt_count)} บิล`}
              icon={<Building2 className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="ทั่วไป"
              value={formatBaht(overview.summary.general_amount)}
              hint={`${formatCount(overview.summary.general_count)} รายการ`}
              icon={<Users className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="ประเภทที่ใช้"
              value={formatCount(overview.summary.item_count)}
              deltaPct={itemDelta}
              hint={`${formatCount(overview.summary.line_count)} บรรทัดรวม`}
              icon={<Layers3 className="h-4 w-4" />}
            />
          </section>

          <section>
            <ExpenseTrendChart
              title="แนวโน้มรายเดือน"
              rows={overview.trend_monthly}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ExpenseGroupChart
              title="บริษัท vs ทั่วไป"
              rows={sourceChartRows}
            />
            <ExpenseGroupChart
              title="แยกตามหมวด"
              rows={categoryChartRows}
            />
          </section>

          <section>
            <ExpenseItemTable
              rows={overview.top_items}
              totalAmount={overview.summary.amount}
            />
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-700 shadow-sm">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Receipt className="h-4 w-4" />
              แยกตามสาขา
            </div>
            <ul className="mt-3 space-y-2">
              {overview.by_branch.length === 0 ? (
                <li className="text-muted-foreground">ไม่มีข้อมูล</li>
              ) : (
                overview.by_branch.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{row.label || row.key}</span>
                    <span className="tabular-nums font-medium">
                      {formatBaht(row.amount)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <BiHighlightsCard lines={highlightLines} />
          </section>
        </>
      ) : null}
    </div>
  );
}
