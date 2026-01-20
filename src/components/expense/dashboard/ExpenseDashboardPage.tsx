"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigLeftDash, RefreshCcw } from "lucide-react";

import ExpenseSummaryLineChartCard from "./ExpenseSummaryLineChartCard";
import PieChartCard from "./ExpenseSummaryPieChartCard";
import ExpenseSummaryStackedChartCard from "./ExpenseSummaryStackedChartCard";
import ExpenseDashboardTable from "./ExpenseDashboardTable/ExpenseDashboardTable";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// NEW: add these imports
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type ItemYearRow = {
  item_name: string;
  January: number;
  February: number;
  March: number;
  April: number;
  May: number;
  June: number;
  July: number;
  August: number;
  September: number;
  October: number;
  November: number;
  December: number;
  total?: number;
};

type BranchRow = {
  branch_uuid: string;
  branch_name: string;
};

type DataView = "ALL" | "ENTRIES" | "GENERAL";

const DEFAULT_YEAR = new Date().getFullYear();
const TZ = "Asia/Bangkok";

export default function ExpenseDashboardPage() {
  const [expenseSummary, setExpenseSummary] = useState<ItemYearRow[]>([]);
  const [companySummary, setCompanySummary] = useState<ItemYearRow[]>([]);
  const [generalSummary, setGeneralSummary] = useState<ItemYearRow[]>([]);

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | "ALL">("ALL");

  const [dataView, setDataView] = useState<DataView>("ALL");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const [year, setYear] = useState<number>(DEFAULT_YEAR);

  // simple rolling list (adjust if you want)
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const start = 2023;
    const end = Math.max(now + 1, DEFAULT_YEAR); // includes next year
    return Array.from(
      { length: end - start + 1 },
      (_, i) => start + i
    ).reverse();
  }, []);

  const supabase = createClient();
  const router = useRouter();

  // Load branches from public.branch
  useEffect(() => {
    let mounted = true;
    (async () => {
      setBranchesLoading(true);
      const { data, error } = await supabase
        .from("branch")
        .select("branch_uuid, branch_name")
        .order("branch_name", { ascending: true });

      if (mounted) {
        if (error) {
          setErrorMsg(error.message);
        } else {
          setBranches((data ?? []) as BranchRow[]);
        }
        setBranchesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // null means all branches (for the RPCs)
  const pBranch = useMemo(
    () => (selectedBranch === "ALL" ? null : selectedBranch),
    [selectedBranch]
  );

  const fetchSummaries = useCallback(async () => {
    setLoading(true);
    setErrorMsg(undefined);
    try {
      // All expense summary
      const { data, error } = await supabase.rpc("fn_item_year_summary_all", {
        p_year: year,
        p_branch: pBranch,
        p_supplier: null,
        p_timezone: TZ,
      });
      if (error) throw error;
      setExpenseSummary((data ?? []) as ItemYearRow[]);

      // Company entries (full months)
      const { data: dataCompany, error: errorCompany } = await supabase.rpc(
        "fn_item_year_summary_entries_fullmonths",
        {
          p_year: year,
          p_branch: pBranch,
          p_supplier: null,
          p_timezone: TZ,
        }
      );
      if (errorCompany) throw errorCompany;
      setCompanySummary((dataCompany ?? []) as ItemYearRow[]);

      // General (full months)
      const { data: dataGeneral, error: errorGeneral } = await supabase.rpc(
        "fn_item_year_summary_general_fullmonths",
        {
          p_year: year,
          p_branch: pBranch,
          p_timezone: TZ,
        }
      );
      if (errorGeneral) throw errorGeneral;
      setGeneralSummary((dataGeneral ?? []) as ItemYearRow[]);
    } catch (err) {
      const e = err as { message?: string };
      setErrorMsg(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, pBranch, year]);

  // Initial load + reload when branch changes
  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const thb = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(n);

  // ---- New: pick the active dataset + dynamic titles ----
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

  const chartTitle = useMemo(() => {
    switch (dataView) {
      case "ENTRIES":
        return `ค่าใช้จ่ายเฉพาะบริษัท (พ.ศ. ${year + 543})`;
      case "GENERAL":
        return `ค่าใช้จ่ายเฉพาะทั่วไป (พ.ศ. ${year + 543})`;
      case "ALL":
      default:
        return `ค่าใช้จ่ายทั้งหมด (พ.ศ. ${year + 543})`;
    }
  }, [dataView, year]);

  const pieTitle = useMemo(() => {
    switch (dataView) {
      case "ENTRIES":
        return "สัดส่วนค่าใช้จ่ายต่อเดือนเฉพาะบริษัท";
      case "GENERAL":
        return "สัดส่วนค่าใช้จ่ายต่อเดือนเฉพาะทั่วไป";
      case "ALL":
      default:
        return "สัดส่วนค่าใช้จ่ายต่อเดือน";
    }
  }, [dataView]);

  return (
    <section className="flex flex-col justify-center items-center p-4">
      <div className="flex w-full px-2 items-center gap-2">
        <div className="flex-1 flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowBigLeftDash strokeWidth={1} />
            กลับ
          </Button>
        </div>

        <h1 className="text-2xl font-bold tracking-wider">ภาพรวมค่าใช้จ่าย</h1>

        <div className="flex-1 flex justify-end gap-3 items-end">
          {/* Branch selector */}
          <div className="grid gap-1">
            <Label htmlFor="branch">สาขา</Label>
            <Select
              value={selectedBranch}
              onValueChange={(v) =>
                setSelectedBranch(v as typeof selectedBranch)
              }
              disabled={branchesLoading}
            >
              <SelectTrigger id="branch" className="w-44">
                <SelectValue placeholder="เลือกสาขา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกสาขา</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.branch_uuid} value={b.branch_uuid}>
                    {b.branch_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New: Data view selector */}
          <div className="grid gap-1">
            <Label htmlFor="dataview">มุมมองข้อมูล</Label>
            <Select
              value={dataView}
              onValueChange={(v) => setDataView(v as DataView)}
              disabled={loading}
            >
              <SelectTrigger id="dataview" className="w-44">
                <SelectValue placeholder="เลือกมุมมองข้อมูล" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทั้งหมด</SelectItem>
                <SelectItem value="ENTRIES">เฉพาะบริษัท (Entries)</SelectItem>
                <SelectItem value="GENERAL">เฉพาะทั่วไป (General)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year selector */}
          <div className="grid gap-1">
            <Label htmlFor="year">ปี</Label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              disabled={loading}
            >
              <SelectTrigger id="year" className="w-28">
                <SelectValue placeholder="เลือกปี" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {`พ.ศ. ${y + 543}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="secondary"
            onClick={() => fetchSummaries()}
            disabled={loading}
          >
            {loading ? "กำลังโหลด…" : <RefreshCcw />}
          </Button>
        </div>
      </div>

      {!!errorMsg && (
        <div className="mt-2 text-sm text-destructive">{errorMsg}</div>
      )}

      <div className="w-fit grid grid-cols-2 gap-8 p-8 justify-center items-center">
        {/* Single pair of charts: use the selected dataset */}
        <PersistedCard loading={loading} skeletonBars={4}>
          <ExpenseSummaryLineChartCard
            data={currentData}
            title={chartTitle}
            yTickFormatter={thb}
          />
        </PersistedCard>
        <PersistedCard loading={loading} skeletonBars={6}>
          <PieChartCard
            data={currentData}
            title={pieTitle}
            valueFormatter={thb}
            initialMonthIndex={new Date().getMonth()}
          />
        </PersistedCard>

        {/* Stacked comparison stays mounted too */}
        <PersistedCard
          loading={loading}
          skeletonBars={6}
          className="col-span-2"
        >
          {companySummary.length > 0 && generalSummary.length > 0 ? (
            <ExpenseSummaryStackedChartCard
              entriesData={companySummary}
              generalData={generalSummary}
              title="เปรียบเทียบค่าใช้จ่ายรายเดือน"
              yTickFormatter={thb}
            />
          ) : (
            <div className="h-[360px] w-[1000px]" />
          )}
        </PersistedCard>

        {/* Table follows currentData; keep mounted */}
        <PersistedCard
          loading={loading}
          className="w-[80vw] h-[90vh] col-span-2 justify-self-center"
        >
          <ExpenseDashboardTable
            datasetKey={`${dataView}-${selectedBranch ?? "ALL"}-${year}`}
            expenseSummary={currentData.length ? currentData : expenseSummary}
            title={
              dataView === "ALL"
                ? "สรุปค่าใช้จ่ายทั้งหมด"
                : dataView === "ENTRIES"
                ? "สรุปค่าใช้จ่ายเฉพาะบริษัท"
                : "สรุปค่าใช้จ่ายเฉพาะทั่วไป"
            }
          />
        </PersistedCard>
      </div>
    </section>
  );
}

// NEW: a tiny overlay you can reuse anywhere
function LoadingOverlay({
  show,
  skeletonBars = 0,
}: {
  show: boolean;
  skeletonBars?: number;
}) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-2xl border">
      <Loader2 className="h-6 w-6 animate-spin" />
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

// OPTIONAL: a wrapper that keeps children mounted and shows the overlay on top
function PersistedCard({
  loading,
  children,
  skeletonBars = 0,
  className = "",
}: {
  loading: boolean;
  children: React.ReactNode;
  skeletonBars?: number;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <LoadingOverlay show={loading} skeletonBars={skeletonBars} />
    </div>
  );
}
