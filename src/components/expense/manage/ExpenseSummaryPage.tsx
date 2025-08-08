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
      <div className="flex flex-col w-fit">
        <div className="p-2 h-[80vh]">
          {columnVisibility && paginationPageSize && (
            <ExpenseReceiptTable
              columnVisibility={columnVisibility}
              paginationPageSize={paginationPageSize}
            >
              <div className="flex gap-2 flex-1 justify-between items-center">
                <div className="flex gap-2 items-center px-4">
                  <h2 className="text-xl font-bold ">{`รายการบิลค่าใช้จ่าย`}</h2>
                  <ResetTableCookiesDropdown
                    handleResetCookies={handleResetCookies}
                  />
                </div>

                <div>
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
        <div className="p-2 flex-1">
          <ExpenseReceiptDetail />
        </div>
      </div>
    </section>
  );
}
