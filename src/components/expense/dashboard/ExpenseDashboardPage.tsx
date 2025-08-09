"use client";

import { useCallback, useEffect, useState } from "react";

import ExpenseSummaryLineChartCard from "./ExpenseSummaryLineChartCard";
import PieChartCard from "./ExpenseSummaryPieChartCard";
import { createClient } from "@/lib/supabase/client";
import ExpenseSummaryStackedChartCard from "./ExpenseSummaryStackedChartCard";
import ExpenseDashboardTable from "./ExpenseDashboardTable/ExpenseDashboardTable";

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
type TestTotalsRow = {
  source: string;
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
  total: number;
};

export default function ExpenseDashboardPage() {
  const [expenseSummary, setExpenseSummary] = useState<ItemYearRow[]>();
  const [companySummary, setCompanySummary] = useState<ItemYearRow[]>();
  const [generalSummary, setGeneralSummary] = useState<ItemYearRow[]>();

  const supabase = createClient();

  const getReceiptByMonth = useCallback(
    async function () {
      const { data, error } = await supabase.rpc("fn_item_year_summary_all", {
        p_year: 2025,
        p_branch: null, // optional filter
        p_supplier: null, // optional filter
        p_timezone: "Asia/Bangkok",
      });

      if (error) throw error;

      const rows = (data ?? []) as ItemYearRow[];

      setExpenseSummary(rows);

      console.log("company");
      const { data: dataCompany, error: errorCompany } = await supabase.rpc(
        "fn_item_year_summary_entries_fullmonths",
        {
          p_year: 2025,
          p_branch: null, // optional filter
          p_supplier: null, // optional filter
          p_timezone: "Asia/Bangkok",
        }
      );

      if (errorCompany) throw error;

      const rowsCompany = (dataCompany ?? []) as ItemYearRow[];

      setCompanySummary(rowsCompany);

      console.log("general");
      const { data: dataGeneral, error: errorGeneral } = await supabase.rpc(
        "fn_item_year_summary_general_fullmonths",
        {
          p_year: 2025,
          p_branch: null, // optional filter
          p_timezone: "Asia/Bangkok",
        }
      );

      if (errorGeneral) throw error;

      const rowsGeneral = (dataGeneral ?? []) as ItemYearRow[];

      setGeneralSummary(rowsGeneral);

      const { data: dataTest, error: errorTest } = await supabase.rpc(
        "fn_test_totals_receipt_general",
        {
          p_year: 2025,
          p_branch: null, // optional filter
          p_supplier: null, // optional filter
          p_timezone: "Asia/Bangkok",
        }
      );

      if (errorTest) throw error;

      const rowsTest = (dataTest ?? []) as TestTotalsRow[];

      console.table(rowsTest);
    },
    [supabase]
  );

  useEffect(() => {
    getReceiptByMonth();
  }, [getReceiptByMonth]);

  const thb = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="flex justify-center">
      <div className="w-full flex flex-col gap-8 p-8 justify-center items-center">
        {expenseSummary && (
          <>
            <ExpenseSummaryLineChartCard
              data={expenseSummary}
              title="ค่าใช้จ่าย (พ.ศ. 2568)"
              yTickFormatter={thb}
            />
            <PieChartCard
              data={expenseSummary}
              title="สัดส่วนค่าใช้จ่ายต่อเดือน"
              valueFormatter={thb}
              initialMonthIndex={new Date().getMonth()}
            />
            {companySummary && generalSummary && (
              <ExpenseSummaryStackedChartCard
                entriesData={companySummary}
                generalData={generalSummary}
                title="เปรียบเทียบค่าใช้จ่ายรายเดือน"
                yTickFormatter={thb}
              />
            )}
            <div className="w-[80vw] h-[90vh]">
              <ExpenseDashboardTable expenseSummary={expenseSummary} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
