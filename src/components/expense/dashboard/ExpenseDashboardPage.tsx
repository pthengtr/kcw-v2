"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigLeftDash } from "lucide-react";

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

// type TestTotalsRow = {
//   source: string;
//   January: number;
//   February: number;
//   March: number;
//   April: number;
//   May: number;
//   June: number;
//   July: number;
//   August: number;
//   September: number;
//   October: number;
//   November: number;
//   December: number;
//   total: number;
// };

type BranchRow = {
  branch_uuid: string;
  branch_name: string;
};

const YEAR = 2025;
const TZ = "Asia/Bangkok";

export default function ExpenseDashboardPage() {
  const [expenseSummary, setExpenseSummary] = useState<ItemYearRow[]>();
  const [companySummary, setCompanySummary] = useState<ItemYearRow[]>();
  const [generalSummary, setGeneralSummary] = useState<ItemYearRow[]>();

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | "ALL">("ALL");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

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
        p_year: YEAR,
        p_branch: pBranch, // null => all branches
        p_supplier: null,
        p_timezone: TZ,
      });
      if (error) throw error;
      setExpenseSummary((data ?? []) as ItemYearRow[]);

      // Company entries (full months)
      const { data: dataCompany, error: errorCompany } = await supabase.rpc(
        "fn_item_year_summary_entries_fullmonths",
        {
          p_year: YEAR,
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
          p_year: YEAR,
          p_branch: pBranch,
          p_timezone: TZ,
        }
      );
      if (errorGeneral) throw errorGeneral;
      setGeneralSummary((dataGeneral ?? []) as ItemYearRow[]);

      // Optional test/debug
      // const { data: dataTest, error: errorTest } = await supabase.rpc(
      //   "fn_test_totals_receipt_general",
      //   { p_year: YEAR, p_branch: pBranch, p_supplier: null, p_timezone: TZ }
      // );
      // if (errorTest) throw errorTest;
      // console.table((dataTest ?? []) as TestTotalsRow[]);
    } catch (err) {
      const e = err as { message?: string };
      setErrorMsg(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [supabase, pBranch]);

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
          <div className="grid gap-1">
            <Label htmlFor="branch">สาขา</Label>
            <Select
              value={selectedBranch}
              onValueChange={(v) =>
                setSelectedBranch(v as typeof selectedBranch)
              }
              disabled={branchesLoading}
            >
              <SelectTrigger id="branch" className="w-[260px]">
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
          <Button
            variant="secondary"
            onClick={() => fetchSummaries()}
            disabled={loading}
          >
            {loading ? "กำลังโหลด…" : "รีเฟรช"}
          </Button>
        </div>
      </div>

      {!!errorMsg && (
        <div className="mt-2 text-sm text-destructive">{errorMsg}</div>
      )}

      <div className="w-fit grid grid-cols-2 gap-8 p-8 justify-center items-center">
        {expenseSummary && !loading && (
          <>
            <ExpenseSummaryLineChartCard
              data={expenseSummary}
              title={`ค่าใช้จ่ายทั้งหมด (พ.ศ. ${YEAR + 543})`}
              yTickFormatter={thb}
            />
            <PieChartCard
              data={expenseSummary}
              title="สัดส่วนค่าใช้จ่ายต่อเดือน"
              valueFormatter={thb}
              initialMonthIndex={new Date().getMonth()}
            />

            {companySummary && (
              <>
                <ExpenseSummaryLineChartCard
                  data={companySummary}
                  title={`ค่าใช้จ่ายเฉพาะบริษัท (พ.ศ. ${YEAR + 543})`}
                  yTickFormatter={thb}
                />
                <PieChartCard
                  data={companySummary}
                  title="สัดส่วนค่าใช้จ่ายต่อเดือนเฉพาะบริษัท"
                  valueFormatter={thb}
                  initialMonthIndex={new Date().getMonth()}
                />
              </>
            )}

            {generalSummary && (
              <>
                <ExpenseSummaryLineChartCard
                  data={generalSummary}
                  title={`ค่าใช้จ่ายเฉพาะทั่วไป (พ.ศ. ${YEAR + 543})`}
                  yTickFormatter={thb}
                />
                <PieChartCard
                  data={generalSummary}
                  title="สัดส่วนค่าใช้จ่ายต่อเดือนเฉพาะทั่วไป"
                  valueFormatter={thb}
                  initialMonthIndex={new Date().getMonth()}
                />
              </>
            )}

            {companySummary && generalSummary && (
              <div className="col-span-2">
                <ExpenseSummaryStackedChartCard
                  entriesData={companySummary}
                  generalData={generalSummary}
                  title="เปรียบเทียบค่าใช้จ่ายรายเดือน"
                  yTickFormatter={thb}
                />
              </div>
            )}

            <div className="w-[80vw] h-[90vh] col-span-2 justify-self-center">
              <ExpenseDashboardTable expenseSummary={expenseSummary} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
