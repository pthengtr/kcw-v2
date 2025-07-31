"use client";

import ExpenseAddEntryFormDialog from "@/components/expense/create/ExpenseAddEntryFormDialog";
import ExpenseCreateEntryTable, {
  defaultCreateEntryColumnVisibility,
} from "@/components/expense/create/ExpenseCreateEntryTable";
import ExpenseCreateReceiptFormDialog from "@/components/expense/create/ExpenseCreateReceiptFormDialog";
import {
  ExpenseContext,
  ExpenseContextType,
} from "@/components/expense/ExpenseProvider";
import ExpenseItemTable from "@/components/expense/item/ExpenseItemTable";
import { useContext } from "react";

export default function Create() {
  const { selectedItem, createEntries, selectedEntry } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <div className="grid grid-cols-2">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-center">
          {selectedItem && <ExpenseAddEntryFormDialog />}
        </div>
        <ExpenseItemTable />
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex gap-2 justify-center">
          {createEntries.length > 0 && (
            <>
              <ExpenseCreateReceiptFormDialog />
              <ExpenseCreateReceiptFormDialog vat />
            </>
          )}
          {selectedEntry && <ExpenseAddEntryFormDialog update />}
        </div>
        <ExpenseCreateEntryTable
          columnVisibility={defaultCreateEntryColumnVisibility}
          paginationPageSize={10}
        />
      </div>
    </div>
  );
}
