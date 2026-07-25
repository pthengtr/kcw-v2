"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Store,
  Wallet,
} from "lucide-react";

import {
  BRANCH_LABELS,
  CHANNEL_LABELS,
  formatBaht,
  formatCount,
  pctChange,
  SALES_TYPE_LABELS,
  splitAmount,
} from "@/lib/bi/sales-format";
import {
  bangkokCurrentMonthIso,
  bangkokTodayIso,
  formatThaiDateRange,
  periodLabel,
  preferDailyBreakdown,
  resolvePeriodRange,
} from "@/lib/bi/sales-periods";
import type {
  BiBranchFilter,
  BiCustomDateMode,
  BiPeriodPreset,
  BiSalesOverview,
} from "@/lib/bi/sales-types";
import { cn } from "@/lib/utils";
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

import SalesBilltypeTable from "./SalesBilltypeTable";
import SalesKpiCard from "./SalesKpiCard";
import SalesPeriodTable from "./SalesPeriodTable";
import SalesSplitChart from "./SalesSplitChart";
import SalesTrendChart from "./SalesTrendChart";

const PERIODS: BiPeriodPreset[] = ["month", "ytd", "custom"];

export default function SalesOverviewPage() {
  const [preset, setPreset] = useState<BiPeriodPreset>("month");
  const [branch, setBranch] = useState<BiBranchFilter>("ALL");
  const [customMode, setCustomMode] = useState<BiCustomDateMode>("single");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMonth, setCustomMonth] = useState("");
  const [overview, setOverview] = useState<BiSalesOverview | null>(null);
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
      });
      if (branch !== "ALL") params.set("branch", branch);

      const res = await fetch(`/api/bi/sales/overview?${params.toString()}`);
      const json = (await res.json()) as {
        overview?: BiSalesOverview;
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
  const periodRows = trendRows;

  const revenueDelta = overview
    ? pctChange(
        overview.summary.revenue_net,
        overview.previous_summary.revenue_net
      )
    : null;
  const billDelta = overview
    ? pctChange(
        overview.summary.bill_count,
        overview.previous_summary.bill_count
      )
    : null;
  const vatDelta = overview
    ? pctChange(overview.summary.vat_baht, overview.previous_summary.vat_baht)
    : null;

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              ภาพรวมยอดขาย
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ยอดสุทธิก่อน VAT · ตัดโอนสาขา (TF/TFV) และ TAR ตามกฎใน docs/bi
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
              <Label htmlFor="bi-branch">สาขา</Label>
              <Select
                value={branch}
                onValueChange={(v) => setBranch(v as BiBranchFilter)}
              >
                <SelectTrigger id="bi-branch" className="w-full">
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
                  <Label htmlFor="bi-custom-mode">รูปแบบวันที่</Label>
                  <Select
                    value={customMode}
                    onValueChange={(v) =>
                      setCustomMode(v as BiCustomDateMode)
                    }
                  >
                    <SelectTrigger id="bi-custom-mode" className="w-full">
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
                    <Label htmlFor="bi-month">เดือน</Label>
                    <input
                      id="bi-month"
                      type="month"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bi-from">
                        {customMode === "single" ? "วันที่" : "จากวันที่"}
                      </Label>
                      <input
                        id="bi-from"
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
                        <Label htmlFor="bi-to">ถึงวันที่</Label>
                        <input
                          id="bi-to"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SalesKpiCard
              title="ยอดขายสุทธิ"
              value={formatBaht(overview.summary.revenue_net)}
              deltaPct={revenueDelta}
              hint="ก่อน VAT"
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="จำนวนบิล"
              value={formatCount(overview.summary.bill_count)}
              deltaPct={billDelta}
              icon={<ReceiptText className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="เฉลี่ยต่อบิล"
              value={formatBaht(overview.summary.avg_bill)}
              hint="ยอดสุทธิ / บิล"
              icon={<Store className="h-4 w-4" />}
            />
            <SalesKpiCard
              title="VAT ที่เก็บได้"
              value={formatBaht(overview.summary.vat_baht)}
              deltaPct={vatDelta}
              hint="แยกจากยอดขาย"
              icon={<Building2 className="h-4 w-4" />}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <SalesSplitChart
              title="VAT vs Non-VAT"
              rows={overview.by_sales_type}
              labels={SALES_TYPE_LABELS}
            />
            <SalesSplitChart
              title="HQ / SYP / ออนไลน์"
              rows={overview.by_branch}
              labels={BRANCH_LABELS}
            />
            <SalesSplitChart
              title="ออนไลน์ vs หน้าร้าน"
              rows={overview.by_channel}
              labels={CHANNEL_LABELS}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <SalesTrendChart
                title={useDaily ? "แนวโน้มรายวัน" : "แนวโน้มรายเดือน"}
                rows={trendRows}
                mode={useDaily ? "daily" : "monthly"}
              />
            </div>
            <div className="xl:col-span-2">
              <SalesBilltypeTable rows={overview.by_billtype} />
            </div>
          </section>

          <section>
            <SalesPeriodTable
              rows={periodRows}
              mode={useDaily ? "daily" : "monthly"}
            />
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
              <CalendarDays className="h-4 w-4" aria-hidden />
              สรุปสัดส่วนหลัก
            </div>
            <ul className="grid grid-cols-1 gap-2 text-muted-foreground sm:grid-cols-2">
              <li>
                VAT{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_sales_type, "VAT"))}
                </span>
                {" · "}
                Non-VAT{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_sales_type, "NON_VAT"))}
                </span>
              </li>
              <li>
                HQ{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_branch, "HQ"))}
                </span>
                {" · "}
                SYP{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_branch, "SYP"))}
                </span>
                {" · "}
                ออนไลน์{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_branch, "ONLINE"))}
                </span>
              </li>
              <li>
                ช่องทาง ออนไลน์{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_channel, "ONLINE"))}
                </span>
                {" · "}
                หน้าร้าน{" "}
                <span className="font-medium text-slate-800">
                  {formatBaht(splitAmount(overview.by_channel, "COUNTER"))}
                </span>
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
