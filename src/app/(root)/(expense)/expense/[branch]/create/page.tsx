"use client";

import ExpenseItemTable from "@/components/expense/create/ExpenseItemTable";

export default function Create() {
  return (
    <div className="grid grid-cols-3">
      <div className="col-span-2">
        <ExpenseItemTable />
      </div>
      <div className=""></div>
    </div>
  );
}
