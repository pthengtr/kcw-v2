"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCcw,
  Table2,
} from "lucide-react";

import type {
  BiSalesCompareMode,
  BiSalesCompareResult,
  BiSalesCompareViz,
} from "@/lib/bi/sales-compare-types";
import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import {
  bangkokCurrentMonthIso,
  bangkokTodayIso,
} from "@/lib/bi/sales-periods";
import type { BiBranchFilter } from "@/lib/bi/sales-types";
import { cn } from "@/lib/utils";
import SalesCompareVisual from "@/components/bi/sales/SalesCompareVisual";
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

const MODE_LABEL: Record<BiSalesCompareMode, string> = {
  years: "เทียบปี",
  months: "เทียบเดือน",
};

const VIZ_OPTIONS: { key: BiSalesCompareViz; label: string; icon: typeof Table2 }[] =
  [
    { key: "table", label: "ตาราง", icon: Table2 },
    { key: "bar", label: "แท่ง", icon: BarChart3 },
    { key: "line", label: "เส้น", icon: LineChartIcon },
  ];

function yearOptions(now = new Date()): number[] {
  const current = Number(bangkokTodayIso(now).slice(0, 4));
  const start = 2023;
  return Array.from({ length: current - start + 1 }, (_, i) => current - i);
}

export default function SalesComparePage() {
  const yearsAvailable = useMemo(() => yearOptions(), []);
  const [mode, setMode] = useState<BiSalesCompareMode>("years");
  const [selectedYears, setSelectedYears] = useState<number[]>(() => {
    const current = Number(bangkokTodayIso().slice(0, 4));
    return current > 2023 ? [current - 1, current] : [current];
  });
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(() => {
    const currentMonth = bangkokCurrentMonthIso();
    const [y, m] = currentMonth.split("-").map(Number);
    const prev =
      m === 1
        ? `${y - 1}-12`
        : `${y}-${String(m - 1).padStart(2, "0")}`;
    return [prev, currentMonth];
  });
  const [draftMonth, setDraftMonth] = useState(bangkokCurrentMonthIso());
  const [branch, setBranch] = useState<BiBranchFilter>("ALL");
  const [viz, setViz] = useState<BiSalesCompareViz>("bar");
  const [compare, setCompare] = useState<BiSalesCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode });
      if (branch !== "ALL") params.set("branch", branch);
      if (mode === "years") {
        params.set("years", selectedYears.join(","));
      } else {
        params.set("periods", selectedPeriods.join(","));
      }

      const res = await fetch(`/api/bi/sales/compare?${params.toString()}`);
      const json = (await res.json()) as {
        compare?: BiSalesCompareResult;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      if (!json.compare) throw new Error("ไม่มีข้อมูล");
      setCompare(json.compare);
    } catch (err) {
      setCompare(null);
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [mode, branch, selectedYears, selectedPeriods]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleYear = (year: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        if (prev.length === 1) return prev;
        return prev.filter((y) => y !== year).sort((a, b) => a - b);
      }
      return [...prev, year].sort((a, b) => a - b).slice(-3);
    });
  };

  const addPeriod = () => {
    if (!draftMonth) return;
    setSelectedPeriods((prev) => {
      if (prev.includes(draftMonth)) return prev;
      return [...prev, draftMonth].sort().slice(-6);
    });
  };

  const removePeriod = (period: string) => {
    setSelectedPeriods((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((p) => p !== period);
    });
  };

  const summaryCards = useMemo(() => {
    if (!compare) return [];
    if (compare.mode === "years") {
      return compare.series.map((s) => ({
        key: String(s.year),
        title: `ปี ${s.year + 543}`,
        value: formatBaht(s.total_revenue_net),
        hint: `${formatCount(s.total_bill_count)} บิล · ${s.from} → ${s.to}`,
      }));
    }
    return compare.period_points.map((p) => ({
      key: p.period,
      title: p.label,
      value: formatBaht(p.revenue_net),
      hint: `${formatCount(p.bill_count)} บิล`,
    }));
  }, [compare]);

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              เปรียบเทียบยอดขาย
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              เทียบปี (รายเดือนซ้อนกัน) หรือเทียบเดือนที่เลือก · สลับตาราง / แท่ง / เส้น
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

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="โหมดเปรียบเทียบ">
            {(Object.keys(MODE_LABEL) as BiSalesCompareMode[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={mode === key ? "default" : "outline"}
                className={cn(mode === key && "bg-slate-800 hover:bg-slate-700")}
                onClick={() => setMode(key)}
              >
                {MODE_LABEL[key]}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bi-sales-compare-branch">สาขา</Label>
              <Select
                value={branch}
                onValueChange={(v) => setBranch(v as BiBranchFilter)}
              >
                <SelectTrigger id="bi-sales-compare-branch" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกสาขา</SelectItem>
                  <SelectItem value="HQ">HQ</SelectItem>
                  <SelectItem value="SYP">SYP</SelectItem>
                  <SelectItem value="ONLINE">ออนไลน์</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>รูปแบบการแสดง</Label>
              <div className="flex flex-wrap gap-2">
                {VIZ_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.key}
                      type="button"
                      size="sm"
                      variant={viz === option.key ? "default" : "outline"}
                      className={cn(
                        viz === option.key && "bg-slate-800 hover:bg-slate-700"
                      )}
                      onClick={() => setViz(option.key)}
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {mode === "years" ? (
            <div className="space-y-1.5">
              <Label>เลือกปี (สูงสุด 3 ปี)</Label>
              <div className="flex flex-wrap gap-2">
                {yearsAvailable.map((year) => {
                  const active = selectedYears.includes(year);
                  return (
                    <Button
                      key={year}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className={cn(
                        active && "bg-slate-800 hover:bg-slate-700"
                      )}
                      onClick={() => toggleYear(year)}
                    >
                      {year + 543}
                      <span className="ml-1 text-[10px] opacity-80">
                        ({year})
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>เลือกเดือน–ปี เพื่อเปรียบเทียบ (สูงสุด 6)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1.5 sm:max-w-xs">
                  <input
                    type="month"
                    value={draftMonth}
                    onChange={(e) => setDraftMonth(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addPeriod}>
                  เพิ่มเดือน
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPeriods.map((period) => (
                  <Button
                    key={period}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => removePeriod(period)}
                    title="คลิกเพื่อลบ"
                  >
                    {period}
                    <span className="ml-1 text-xs text-muted-foreground">×</span>
                  </Button>
                ))}
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

      {loading && !compare ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {compare ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map((card) => (
              <SalesKpiCard
                key={card.key}
                title={card.title}
                value={card.value}
                hint={card.hint}
              />
            ))}
          </section>

          <section>
            <SalesCompareVisual compare={compare} viz={viz} />
          </section>
        </>
      ) : null}
    </div>
  );
}
