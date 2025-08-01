"use client";

import { useContext, useEffect } from "react";
import { DataTable } from "@/components/common/DataTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { expenseCategoryColumn } from "./ExpenseCategoryColumn";

type ExpenseCategoryTableProps = { children?: React.ReactNode };

export const defaultColumnVisibility = {
  รหัสหมวด: false,
};

export default function ExpenseCategoryTable({
  children,
}: ExpenseCategoryTableProps) {
  const {
    expenseCategories,
    totalCategory,
    setSelectedCategory,
    getCategory,
    openAddCategoryDialog,
    openUpdateCategoryDialog,
    columnFilters,
    setColumnFilters,
    setSubmitError,
  } = useContext(ExpenseContext) as ExpenseContextType;

  useEffect(() => {
    if (!openAddCategoryDialog && !openUpdateCategoryDialog) {
      getCategory();
    }
    setSubmitError(undefined);
  }, [
    getCategory,
    openAddCategoryDialog,
    openUpdateCategoryDialog,
    setSubmitError,
  ]);

  return (
    <div className="h-full">
      {!!expenseCategories && (
        <DataTable
          tableName="category"
          columns={expenseCategoryColumn}
          data={expenseCategories}
          total={totalCategory}
          setSelectedRow={setSelectedCategory}
          customColumnFilters={columnFilters}
          setCustomColumnFilters={setColumnFilters}
          initialState={{ columnVisibility: defaultColumnVisibility }}
        >
          {children}
        </DataTable>
      )}
    </div>
  );
}
