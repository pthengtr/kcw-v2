"use client";

import { useCallback, useContext, useEffect } from "react";
import { DataTable } from "@/components/common/DataTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { createClient } from "@/lib/supabase/client";
import { expenseGeneralColumn } from "./ExpenseGeneralColumn";

type ExpenseCategoryTableProps = { children?: React.ReactNode };

export const defaultColumnVisibility = {};

export default function ExpenseGeneralTable({
  children,
}: ExpenseCategoryTableProps) {
  const {
    generalEntries,
    setGeneralEntries,
    totalGeneralEntries,
    setTotalGeneralEntries,
    setSubmitError,
    setSelectedGeneralEntry,
    openCreateExpenseGeneralDialog,
    openUpdateExpenseGeneralDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const getExpenseGeneral = useCallback(
    async function () {
      const supabase = createClient();
      const query = supabase
        .from("expense_general")
        .select("*, expense_item(*), payment_method(*), branch(*)", {
          count: "exact",
        })
        .order("entry_date", { ascending: false })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setGeneralEntries(data);
      }
      if (count !== null && count !== undefined) setTotalGeneralEntries(count);
    },
    [setGeneralEntries, setTotalGeneralEntries]
  );

  useEffect(() => {
    setSubmitError(undefined);
    getExpenseGeneral();
  }, [
    getExpenseGeneral,
    setSubmitError,
    openCreateExpenseGeneralDialog,
    openUpdateExpenseGeneralDialog,
  ]);

  return (
    <div className="h-full">
      {!!generalEntries && (
        <DataTable
          tableName="category"
          columns={expenseGeneralColumn}
          data={generalEntries}
          total={totalGeneralEntries}
          setSelectedRow={setSelectedGeneralEntry}
          initialState={{ columnVisibility: defaultColumnVisibility }}
        >
          {children}
        </DataTable>
      )}
    </div>
  );
}
