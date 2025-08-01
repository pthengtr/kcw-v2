"use client";

import { DataTable } from "@/components/common/DataTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { expenseItemColumn } from "./ExpenseItemColumn";
import { useContext, useEffect } from "react";

type ExpenseItemTableProps = { children?: React.ReactNode };

export const defaultColumnVisibility = {
  รหัส: false,
};

export default function ExpenseItemTable({ children }: ExpenseItemTableProps) {
  const {
    expenseItems,
    totalItem,
    setSelectedItem,
    getItems,
    openAddItemDialog,
    openUpdateItemDialog,
    columnFilters,
    setColumnFilters,
    setSubmitError,
  } = useContext(ExpenseContext) as ExpenseContextType;

  useEffect(() => {
    if (!openAddItemDialog && !openUpdateItemDialog) {
      getItems();
    }
    setSubmitError(undefined);
  }, [getItems, openAddItemDialog, openUpdateItemDialog, setSubmitError]);

  return (
    <div className="h-full">
      {!!expenseItems && (
        <DataTable
          tableName="item"
          columns={expenseItemColumn}
          data={expenseItems}
          total={totalItem}
          setSelectedRow={setSelectedItem}
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
