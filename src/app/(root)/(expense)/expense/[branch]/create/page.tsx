"use client";

import ExpenseCreateEntryTable, {
  defaultCreateEntryColumnVisibility,
} from "@/components/expense/create/ExpenseCreateEntryTable";
import ExpenseItemTable from "@/components/expense/create/ExpenseItemTable";

export default function Create() {
  return (
    <div className="grid grid-cols-2">
      <div className="p-4">
        <ExpenseItemTable />
      </div>
      <div className="p-4">
        <ExpenseCreateEntryTable
          columnVisibility={defaultCreateEntryColumnVisibility}
          paginationPageSize={10}
        />
      </div>
    </div>
  );
}
