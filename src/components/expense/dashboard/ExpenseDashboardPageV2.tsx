"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowBigLeftDash,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Layers3,
  Loader2,
  ReceiptText,
  RefreshCcw,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import ExpenseSummaryLineChartCard from "./ExpenseSummaryLineChartCard";
import PieChartCard from "./ExpenseSummaryPieChartCard";
import ExpenseSummaryStackedChartCard from "./ExpenseSummaryStackedChartCard";
import ExpenseDashboardTable from "./ExpenseDashboardTable/ExpenseDashboardTable";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type MonthKey =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export type ItemYearRow = Record<MonthKey, number> & {
  item_name: string;
  total?: number;
};

type BranchRow = {
  branch_uuid: string;
  branch_name: string;
};

type DataView = "ALL" | "ENTRIES" | "GENERAL";
type RelationRow<T> = T | T[] | null;

type RecentExpenseRow = {
  id: string;
  source: "ENTRIES" | "GENERAL";
  date: string;
  title: string;
  description?: string | null;
  branchName?: string | null;
  paymentDescription?: string | null;
  amount: number;
};

type ReceiptRecentRow = {
  receipt_uuid: string;
  receipt_number: string | null;
  receipt_date: string;
  total_amount: number | null;
  discount: number | null;
  tax_exempt: number | null;
  vat: number | null;
  withholding: number | null;
  voucher_description: string | null;
  remark: string | null;
  branch?: RelationRow<{ branch_name: string | null }>;
  payment_method?: RelationRow<{ payment_description: string | null }>;
  party?: RelationRow<{ party_name: string | null }>;
};

type GeneralRecentRow = {
  general_uuid: string;
  entry_date: string;
  description: string | null;
  unit_price: number | null;
  quantity: number | null;
  remark: string | null;
  branch?: RelationRow<{ branch_name: string | null }>;
  payment_method?: RelationRow<{ payment_description: string | null }>;
  expense_item?: RelationRow<{ item_name: string | null }>;
};

type MonthSummary = {
  key: MonthKey;
  label: string;
  shortLabel: string;
  value: number;
  entries: number;
  general: number;
};

const MONTHS: { key: MonthKey; label: string; shortLabel: string }[] = [
  { key: "January", label: "มกราคม", shortLabel: "ม.ค." },
  { key: "February", label: "กุมภาพันธ์", shortLabel: "ก.พ." },
  { key: "March", label: "มีนาคม", shortLabel: "มี.ค." },
  { key: "April", label: "เมษายน", shortLabel: "เม.ย." },
  { key: "May", label: "พฤษภาคม", shortLabel: "พ.ค." },
  { key: "June", label: "มิถุนายน", shortLabel: "มิ.ย." },
  { key: "July", label: "กรกฎาคม", shortLabel: "ก.ค." },
  { key: "August", label: "สิงหาคม", shortLabel: "ส.ค." },
  { key: "September", label: "กันยายน", shortLabel: "ก.ย." },
  { key: "October", label: "ตุลาคม", shortLabel: "ต.ค." },
  { key: "November", label: "พฤศจิกายน", shortLabel: "พ.ย." },
  { key: "December", label: "ธันวาคม", shortLabel: "ธ.ค." },
];

const DEFAULT_YEAR = new Date().getFullYear();
const TZ = "Asia/Bangkok";
const ALL_ITEM_NAME = "ทั้งหมด";

const DATA_VIEW_LABEL: Record<DataView, string> = {
  ALL: "ทั้งหมด",
  ENTRIES: "บริษัท",
  GENERAL: "ทั่วไป",
};

const DATA_VIEW_DESCRIPTION: Record<DataView, string> = {
  ALL: "รวมค่าใช้จ่ายบริษัทและทั่วไป",
  ENTRIES: "เฉพาะค่าใช้จ่ายบริษัทจากบิล",
  GENERAL: "เฉพาะค่าใช้จ่ายทั่วไป",
};

const compactThb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullThb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const preciseThb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

export default function ExpenseDashboardPageV2() {
  const [expenseSummary, setExpenseSummary] = useState<ItemYearRow[]>([]);
  const [companySummary, setCompanySummary] = useState<ItemYearRow[]>([]);
  const [generalSummary, setGeneralSummary] = useState<ItemYearRow[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpenseRow[]>([]);

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | "ALL">("ALL");
  const [dataView, setDataView] = useState<DataView>("ALL");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [year, setYear] = useState<number>(DEFAULT_YEAR);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const start = 2023;
    const end = Math.max(now + 1, DEFAULT_YEAR);
    return Array.from(
      { length: end - start + 1 },
      (_, i) => start + i
    ).reverse();
  }, []);

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setBranchesLoading(true);
      const { data, error } = await supabase
        .from("branch")
        .select("branch_uuid, branch_name")
        .order("branch_name", { ascending: true });

      if (!mounted) return;

      if (error) {
        setErrorMsg(error.message);
      } else {
        setBranches((data ?? []) as BranchRow[]);
      }
      setBranchesLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const pBranch = useMemo(
    () => (selectedBranch === "ALL" ? null : selectedBranch),
    [selectedBranch]
  );

  const selectedBranchName = useMemo(() => {
    if (selectedBranch === "ALL") return "ทุกสาขา";
    return (
      branches.find((branch) => branch.branch_uuid === selectedBranch)
        ?.branch_name ?? "สาขาที่เลือก"
    );
  }, [branches, selectedBranch]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(undefined);
    try {
      const [allResult, companyResult, generalResult, recentResult] =
        await Promise.all([
          supabase.rpc("fn_item_year_summary_all", {
            p_year: year,
            p_branch: pBranch,
            p_supplier: null,
            p_timezone: TZ,
          }),
          supabase.rpc("fn_item_year_summary_entries_fullmonths", {
            p_year: year,
            p_branch: pBranch,
            p_supplier: null,
            p_timezone: TZ,
          }),
          supabase.rpc("fn_item_year_summary_general_fullmonths", {
            p_year: year,
            p_branch: pBranch,
            p_timezone: TZ,
          }),
          fetchRecentExpenses(supabase, year, pBranch),
        ]);

      if (allResult.error) throw allResult.error;
      if (companyResult.error) throw companyResult.error;
      if (generalResult.error) throw generalResult.error;

      setExpenseSummary(normalizeSummaryRows(allResult.data ?? []));
      setCompanySummary(normalizeSummaryRows(companyResult.data ?? []));
      setGeneralSummary(normalizeSummaryRows(generalResult.data ?? []));
      setRecentExpenses(recentResult);
    } catch (err) {
      const e = err as { message?: string };
      setErrorMsg(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, pBranch, year]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const currentData = useMemo(() => {
    switch (dataView) {
      case "ENTRIES":
        return companySummary;
      case "GENERAL":
        return generalSummary;
      case "ALL":
      default:
        return expenseSummary;
    }
  }, [dataView, expenseSummary, companySummary, generalSummary]);

  const totals = useMemo(
    () =>
      buildDashboardTotals({
        currentData,
        companySummary,
        generalSummary,
        year,
      }),
    [currentData, companySummary, generalSummary, year]
  );

  const filteredRecentExpenses = useMemo(() => {
    return recentExpenses
      .filter((expense) => dataView === "ALL" || expense.source === dataView)
      .slice(0, 8);
  }, [dataView, recentExpenses]);

  const chartTitle = `${DATA_VIEW_LABEL[dataView]} (พ.ศ. ${year + 543})`;
  const tableTitle =
    dataView === "ALL"
      ? "สรุปค่าใช้จ่ายทั้งหมด"
      : dataView === "ENTRIES"
        ? "สรุปค่าใช้จ่ายบริษัท"
        : "สรุปค่าใช้จ่ายทั่วไป";

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 lg:px-8">
      <div className="flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              aria-label="กลับ"
              className="shrink-0"
            >
              <ArrowBigLeftDash strokeWidth={1.4} />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  ภาพรวมค่าใช้จ่าย
                </h1>
                <Badge variant="secondary">{selectedBranchName}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {DATA_VIEW_DESCRIPTION[dataView]} พร้อมสรุปแนวโน้ม หมวดหลัก
                และรายการล่าสุด
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-[1fr_1fr_auto_auto]">
            <FilterSelect
              id="branch"
              label="สาขา"
              value={selectedBranch}
              onValueChange={(value) => setSelectedBranch(value)}
              disabled={branchesLoading}
            >
              <SelectItem value="ALL">ทุกสาขา</SelectItem>
              {branches.map((branch) => (
                <SelectItem
                  key={branch.branch_uuid}
                  value={branch.branch_uuid}
                >
                  {branch.branch_name}
                </SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect
              id="dataview"
              label="มุมมองข้อมูล"
              value={dataView}
              onValueChange={(value) => setDataView(value as DataView)}
              disabled={loading}
            >
              <SelectItem value="ALL">ทั้งหมด</SelectItem>
              <SelectItem value="ENTRIES">บริษัท</SelectItem>
              <SelectItem value="GENERAL">ทั่วไป</SelectItem>
            </FilterSelect>

            <FilterSelect
              id="year"
              label="ปี"
              value={String(year)}
              onValueChange={(value) => setYear(Number(value))}
              disabled={loading}
            >
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {`พ.ศ. ${option + 543}`}
                </SelectItem>
              ))}
            </FilterSelect>

            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => fetchDashboard()}
                disabled={loading}
                className="w-full lg:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                รีเฟรช
              </Button>
            </div>
          </div>
        </div>

        {!!errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<WalletCards className="h-4 w-4" />}
          label="รวมทั้งปี"
          value={fullThb.format(totals.annualTotal)}
          helper={`${totals.activeCategories.toLocaleString("th-TH")} หมวดที่มีรายการ`}
          loading={loading}
        />
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="เดือนนี้"
          value={fullThb.format(totals.currentMonthTotal)}
          helper={totals.currentMonthLabel}
          trend={totals.monthChangePercent}
          loading={loading}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="เฉลี่ยต่อเดือน"
          value={fullThb.format(totals.monthlyAverage)}
          helper={`เดือนสูงสุด ${totals.peakMonth.label}`}
          loading={loading}
        />
        <MetricCard
          icon={<Layers3 className="h-4 w-4" />}
          label="สะสม YTD"
          value={fullThb.format(totals.ytdTotal)}
          helper={`${totals.ytdProgress.toLocaleString("th-TH", {
            maximumFractionDigits: 0,
          })}% ของทั้งปี`}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  สรุปรายเดือน
                </CardTitle>
                <CardDescription>
                  เห็นความเคลื่อนไหวครบ 12 เดือนในหน้าจอมือถือ
                </CardDescription>
              </div>
              <Badge variant="outline">
                {compactThb.format(totals.peakMonth.value)} สูงสุด
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <MonthlyProgressList months={totals.months} loading={loading} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
          <SourceSplitCard
            entriesTotal={totals.entriesTotal}
            generalTotal={totals.generalTotal}
            loading={loading}
          />
          <TopCategoriesCard
            categories={totals.topCategories}
            annualTotal={totals.annualTotal}
            loading={loading}
          />
        </div>
      </div>

      <RecentExpensesCard expenses={filteredRecentExpenses} loading={loading} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PersistedCard loading={loading} skeletonBars={4}>
          <ExpenseSummaryLineChartCard
            data={currentData}
            title={`แนวโน้ม${chartTitle}`}
            yTickFormatter={(value) => compactThb.format(value)}
          />
        </PersistedCard>
        <PersistedCard loading={loading} skeletonBars={6}>
          <PieChartCard
            data={currentData}
            title={`สัดส่วน${DATA_VIEW_LABEL[dataView]}`}
            valueFormatter={(value) => fullThb.format(value)}
            initialMonthIndex={new Date().getMonth()}
          />
        </PersistedCard>
      </div>

      <PersistedCard loading={loading} skeletonBars={6}>
        {companySummary.length > 0 || generalSummary.length > 0 ? (
          <ExpenseSummaryStackedChartCard
            entriesData={companySummary}
            generalData={generalSummary}
            title="เปรียบเทียบบริษัทกับทั่วไป"
            yTickFormatter={(value) => compactThb.format(value)}
          />
        ) : (
          <EmptyCard title="เปรียบเทียบบริษัทกับทั่วไป" />
        )}
      </PersistedCard>

      <PersistedCard
        loading={loading}
        className="min-h-[520px] overflow-hidden rounded-xl border bg-card"
      >
        <ExpenseDashboardTable
          datasetKey={`${dataView}-${selectedBranch}-${year}`}
          expenseSummary={currentData}
          title={tableTitle}
        />
      </PersistedCard>
    </section>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onValueChange,
  disabled,
  className,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  trend,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  trend?: number;
  loading: boolean;
}) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const trendPositive = (trend ?? 0) >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <div className="rounded-full bg-primary/10 p-2 text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <>
            <div className="truncate text-2xl font-bold">{value}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{helper}</span>
              {hasTrend && (
                <Badge
                  variant={trendPositive ? "secondary" : "outline"}
                  className={cn(
                    "gap-1",
                    trendPositive
                      ? "text-emerald-700"
                      : "border-orange-200 text-orange-700"
                  )}
                >
                  {trendPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(trend ?? 0).toLocaleString("th-TH", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MonthlyProgressList({
  months,
  loading,
}: {
  months: MonthSummary[];
  loading: boolean;
}) {
  const max = Math.max(...months.map((month) => month.value), 1);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {months.map((month) => {
        const percent = (month.value / max) * 100;
        return (
          <div key={month.key} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{month.shortLabel}</div>
              <div className="text-right text-sm font-semibold tabular-nums">
                {compactThb.format(month.value)}
              </div>
            </div>
            <Progress value={percent} className="mt-2 h-2" />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>บริษัท {compactThb.format(month.entries)}</span>
              <span>ทั่วไป {compactThb.format(month.general)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceSplitCard({
  entriesTotal,
  generalTotal,
  loading,
}: {
  entriesTotal: number;
  generalTotal: number;
  loading: boolean;
}) {
  const total = entriesTotal + generalTotal;
  const entriesPercent = total > 0 ? (entriesTotal / total) * 100 : 0;
  const generalPercent = total > 0 ? (generalTotal / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers3 className="h-5 w-5 text-primary" />
          แหล่งที่มา
        </CardTitle>
        <CardDescription>แยกค่าใช้จ่ายบริษัทและทั่วไป</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : (
          <>
            <SourceRow
              icon={<Building2 className="h-4 w-4" />}
              label="บริษัท"
              value={entriesTotal}
              percent={entriesPercent}
            />
            <SourceRow
              icon={<Users className="h-4 w-4" />}
              label="ทั่วไป"
              value={generalTotal}
              percent={generalPercent}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SourceRow({
  icon,
  label,
  value,
  percent,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <span className="rounded-full bg-muted p-1.5 text-muted-foreground">
            {icon}
          </span>
          {label}
        </div>
        <div className="text-right font-semibold">
          {fullThb.format(value)}
          <span className="ml-2 text-xs text-muted-foreground">
            {percent.toLocaleString("th-TH", { maximumFractionDigits: 0 })}%
          </span>
        </div>
      </div>
      <Progress value={percent} />
    </div>
  );
}

function TopCategoriesCard({
  categories,
  annualTotal,
  loading,
}: {
  categories: { name: string; total: number }[];
  annualTotal: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ReceiptText className="h-5 w-5 text-primary" />
          หมวดค่าใช้จ่ายสูงสุด
        </CardTitle>
        <CardDescription>จัดอันดับจากยอดรวมของมุมมองที่เลือก</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))
        ) : categories.length > 0 ? (
          categories.map((category, index) => {
            const percent =
              annualTotal > 0 ? (category.total / annualTotal) * 100 : 0;
            return (
              <div key={category.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 font-medium">
                    <span className="mr-2 text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="break-words">{category.name}</span>
                  </div>
                  <div className="shrink-0 font-semibold tabular-nums">
                    {compactThb.format(category.total)}
                  </div>
                </div>
                <Progress value={percent} />
              </div>
            );
          })
        ) : (
          <EmptyState message="ไม่มีข้อมูลหมวดค่าใช้จ่าย" />
        )}
      </CardContent>
    </Card>
  );
}

function RecentExpensesCard({
  expenses,
  loading,
}: {
  expenses: RecentExpenseRow[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ReceiptText className="h-5 w-5 text-primary" />
          รายการล่าสุด
        </CardTitle>
        <CardDescription>
          รวมรายการบริษัทและทั่วไปตามตัวกรองปี/สาขา
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : expenses.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {expenses.map((expense) => (
              <div
                key={`${expense.source}-${expense.id}`}
                className="rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge
                    variant={
                      expense.source === "ENTRIES" ? "secondary" : "outline"
                    }
                  >
                    {expense.source === "ENTRIES" ? "บริษัท" : "ทั่วไป"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(expense.date)}
                  </div>
                </div>
                <div className="mt-3 min-h-10 break-words font-medium">
                  {expense.title}
                </div>
                <div className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">
                  {expense.description || expense.paymentDescription || "-"}
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="truncate text-xs text-muted-foreground">
                    {expense.branchName}
                  </div>
                  <div className="shrink-0 font-semibold tabular-nums">
                    {preciseThb.format(expense.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="ไม่มีรายการล่าสุดตามตัวกรองนี้" />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState message="ไม่มีข้อมูลสำหรับกราฟนี้" />
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function LoadingOverlay({
  show,
  skeletonBars = 0,
}: {
  show: boolean;
  skeletonBars?: number;
}) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl border bg-background/70 backdrop-blur-sm">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {skeletonBars > 0 && (
        <div className="w-4/5 space-y-2">
          {Array.from({ length: skeletonBars }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}

function PersistedCard({
  loading,
  children,
  skeletonBars = 0,
  className = "",
}: {
  loading: boolean;
  children: ReactNode;
  skeletonBars?: number;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      {children}
      <LoadingOverlay show={loading} skeletonBars={skeletonBars} />
    </div>
  );
}

async function fetchRecentExpenses(
  supabase: ReturnType<typeof createClient>,
  year: number,
  branchUuid: string | null
): Promise<RecentExpenseRow[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  let receiptQuery = supabase
    .from("expense_receipt")
    .select(
      "receipt_uuid, receipt_number, receipt_date, total_amount, discount, tax_exempt, vat, withholding, voucher_description, remark, branch(branch_name), payment_method(payment_description), party(party_name)"
    )
    .gte("receipt_date", start)
    .lte("receipt_date", end)
    .order("receipt_date", { ascending: false })
    .limit(8);

  let generalQuery = supabase
    .from("expense_general")
    .select(
      "general_uuid, entry_date, description, unit_price, quantity, remark, branch(branch_name), payment_method(payment_description), expense_item(item_name)"
    )
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false })
    .limit(8);

  if (branchUuid) {
    receiptQuery = receiptQuery.eq("branch_uuid", branchUuid);
    generalQuery = generalQuery.eq("branch_uuid", branchUuid);
  }

  const [receiptResult, generalResult] = await Promise.all([
    receiptQuery,
    generalQuery,
  ]);

  if (receiptResult.error) throw receiptResult.error;
  if (generalResult.error) throw generalResult.error;

  const receipts = ((receiptResult.data ?? []) as unknown as ReceiptRecentRow[])
    .map((receipt) => {
      const party = firstRelation(receipt.party);
      const branch = firstRelation(receipt.branch);
      const payment = firstRelation(receipt.payment_method);

      return {
        id: receipt.receipt_uuid,
        source: "ENTRIES" as const,
        date: receipt.receipt_date,
        title: receipt.receipt_number || party?.party_name || "บิลค่าใช้จ่าย",
        description:
          receipt.voucher_description || receipt.remark || party?.party_name,
        branchName: branch?.branch_name,
        paymentDescription: payment?.payment_description,
        amount: calculateReceiptNet(receipt),
      };
    });

  const general = ((generalResult.data ?? []) as unknown as GeneralRecentRow[])
    .map((entry) => {
      const item = firstRelation(entry.expense_item);
      const branch = firstRelation(entry.branch);
      const payment = firstRelation(entry.payment_method);

      return {
        id: entry.general_uuid,
        source: "GENERAL" as const,
        date: entry.entry_date,
        title: entry.description || item?.item_name || "ค่าใช้จ่ายทั่วไป",
        description: entry.remark || item?.item_name,
        branchName: branch?.branch_name,
        paymentDescription: payment?.payment_description,
        amount: Number(entry.unit_price ?? 0) * Number(entry.quantity ?? 0),
      };
    });

  return [...receipts, ...general]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
}

function buildDashboardTotals({
  currentData,
  companySummary,
  generalSummary,
  year,
}: {
  currentData: ItemYearRow[];
  companySummary: ItemYearRow[];
  generalSummary: ItemYearRow[];
  year: number;
}) {
  const currentTotals = getTotalRow(currentData);
  const entriesTotals = getTotalRow(companySummary);
  const generalTotals = getTotalRow(generalSummary);
  const currentMonthIndex =
    year === DEFAULT_YEAR ? new Date().getMonth() : year < DEFAULT_YEAR ? 11 : 0;
  const annualTotal = sumMonths(currentTotals);
  const currentMonthTotal = Number(
    currentTotals[MONTHS[currentMonthIndex].key] ?? 0
  );
  const previousMonthTotal =
    currentMonthIndex > 0
      ? Number(currentTotals[MONTHS[currentMonthIndex - 1].key] ?? 0)
      : 0;
  const monthChangePercent =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : currentMonthTotal > 0
        ? 100
        : 0;
  const ytdTotal = MONTHS.slice(0, currentMonthIndex + 1).reduce(
    (sum, month) => sum + Number(currentTotals[month.key] ?? 0),
    0
  );
  const monthlyAverage = annualTotal / 12;
  const months = MONTHS.map((month) => ({
    ...month,
    value: Number(currentTotals[month.key] ?? 0),
    entries: Number(entriesTotals[month.key] ?? 0),
    general: Number(generalTotals[month.key] ?? 0),
  }));
  const peakMonth = months.reduce(
    (peak, month) => (month.value > peak.value ? month : peak),
    months[0]
  );
  const topCategories = currentData
    .filter((row) => row.item_name !== ALL_ITEM_NAME)
    .map((row) => ({ name: row.item_name, total: sumMonths(row) }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const activeCategories = currentData.filter(
    (row) => row.item_name !== ALL_ITEM_NAME && sumMonths(row) > 0
  ).length;

  return {
    annualTotal,
    currentMonthTotal,
    currentMonthLabel: MONTHS[currentMonthIndex].label,
    previousMonthTotal,
    monthChangePercent,
    ytdTotal,
    ytdProgress: annualTotal > 0 ? (ytdTotal / annualTotal) * 100 : 0,
    monthlyAverage,
    months,
    peakMonth,
    topCategories,
    activeCategories,
    entriesTotal: sumMonths(entriesTotals),
    generalTotal: sumMonths(generalTotals),
  };
}

function normalizeSummaryRows(rows: unknown[]): ItemYearRow[] {
  return rows.map((row) => {
    const source = row as Partial<ItemYearRow>;
    const normalized = {
      item_name: source.item_name ?? "-",
    } as ItemYearRow;

    for (const month of MONTHS) {
      normalized[month.key] = Number(source[month.key] ?? 0);
    }
    normalized.total = sumMonths(normalized);
    return normalized;
  });
}

function getTotalRow(rows: ItemYearRow[]) {
  const explicitTotal = rows.find((row) => row.item_name === ALL_ITEM_NAME);
  if (explicitTotal) return explicitTotal;

  const total = { item_name: ALL_ITEM_NAME } as ItemYearRow;
  for (const month of MONTHS) {
    total[month.key] = rows.reduce(
      (sum, row) => sum + Number(row[month.key] ?? 0),
      0
    );
  }
  total.total = sumMonths(total);
  return total;
}

function sumMonths(row: ItemYearRow) {
  return MONTHS.reduce((sum, month) => sum + Number(row[month.key] ?? 0), 0);
}

function firstRelation<T>(value: RelationRow<T>): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function calculateReceiptNet(receipt: ReceiptRecentRow) {
  const totalAmount = Number(receipt.total_amount ?? 0);
  const discount = Number(receipt.discount ?? 0);
  const taxableBase = totalAmount - discount - Number(receipt.tax_exempt ?? 0);
  const tax = taxableBase * (Number(receipt.vat ?? 0) / 100);
  const withholding = taxableBase * (Number(receipt.withholding ?? 0) / 100);
  return totalAmount - discount + tax - withholding;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
