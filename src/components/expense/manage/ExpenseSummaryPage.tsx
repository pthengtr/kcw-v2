"use client";
import ExpenseReceiptDetail from "@/components/expense/manage/ExpenseReceiptDetail";
import ExpenseReceiptTable from "@/components/expense/manage/ExpenseReceiptTable";

import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { clearMyCookie, getMyCookie } from "@/app/(root)/action";
import { defaultExpenseReceiptColumnVisibility } from "./ExpenseReceiptColumn";
import ExpenseReceiptSearchForm from "./ExpenseReceiptSearchForm";
import ResetTableCookiesDropdown from "@/components/common/ResetTableCookiesDropdown";
import ExpensePageHeader from "../ExpensePageHeader";

export default function ExpenseSummaryPage() {
  const { resetCreateReceiptForm } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultExpenseReceiptColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getMyCookieClient<T>(
      tableName: string,
      defaultValues: T,
      setValues: (values: T) => void
    ) {
      const data = await getMyCookie(tableName);
      if (data) setValues(JSON.parse(data));
      else setValues(defaultValues);
    }

    async function getCookies() {
      await getMyCookieClient(
        "expenseReceiptColumnVisibility",
        defaultExpenseReceiptColumnVisibility,
        setColumnVisibility
      );
      await getMyCookieClient(
        "expenseReceiptPaginationPageSize",
        10,
        setPaginationPageSize
      );
    }

    getCookies();
  }, []);

  function handleResetCookies() {
    clearMyCookie("expenseReceiptColumnVisibility");
    clearMyCookie("expenseReceiptPaginationPageSize");
  }

  useEffect(() => {
    async function getBranchName() {
      const supabase = createClient();

      const query = supabase
        .from("branch")
        .select("*")
        .eq("branch_uuid", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    getBranchName();
  }, [branch]);

  useEffect(() => {
    resetCreateReceiptForm();
  }, [resetCreateReceiptForm]);

  return (
    <section className="flex flex-col items-center p-2">
      <ExpensePageHeader pageTitle={`จัดการค่าใช้จ่าย ${branchName}`} />
      <div className="flex w-full min-w-0 max-w-full flex-col">
        <div className="h-auto min-h-[50vh] p-2 md:h-[80vh]">
          {columnVisibility && paginationPageSize && (
            <ExpenseReceiptTable
              columnVisibility={columnVisibility}
              paginationPageSize={paginationPageSize}
            >
              <div className="flex flex-1 flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 px-2 sm:px-4">
                  <h2 className="text-lg font-bold sm:text-xl">{`รายการบิลค่าใช้จ่าย`}</h2>
                  <ResetTableCookiesDropdown
                    handleResetCookies={handleResetCookies}
                  />
                </div>

                <div className="min-w-0">
                  <ExpenseReceiptSearchForm
                    defaultValues={{
                      receipt_month: "all",
                    }}
                  />
                </div>
              </div>
            </ExpenseReceiptTable>
          )}
        </div>
        <div className="flex-1 p-2">
          <ExpenseReceiptDetail />
        </div>
      </div>
    </section>
  );
}
