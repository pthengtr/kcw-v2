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
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

export default function ExpenseCreatePage() {
  const { selectedItem, createEntries, selectedEntry } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  useEffect(() => {
    async function getBranchName() {
      const supabase = createClient();

      const query = supabase.from("branch").select("*").eq("branch_id", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    getBranchName();
  }, [branch]);

  return (
    <section className="flex flex-col items-center p-2">
      <h1 className="text-2xl font-bold tracking-wider">{`สร้างบิลค่าใช้จ่าย ${branchName}`}</h1>
      <div className="grid grid-cols-2">
        <div className="p-2 flex flex-col gap-4">
          <ExpenseItemTable>
            <div className="flex flex-1 justify-start items-center gap-2">
              <h2 className="text-xl font-bold pr-2">เลือกประเภทค่าใช้จ่าย</h2>
              <div className="flex justify-center">
                {selectedItem && <ExpenseAddEntryFormDialog />}
              </div>
            </div>
          </ExpenseItemTable>
        </div>
        <div className="p-2 flex flex-col gap-4">
          <ExpenseCreateEntryTable
            columnVisibility={defaultCreateEntryColumnVisibility}
            paginationPageSize={10}
          >
            <div className="flex flex-1 justify-start items-center gap-2">
              <h2 className="text-xl font-bold pr-2">บิลค่าใช้จ่ายใหม่</h2>
              {createEntries.length > 0 && (
                <>
                  <ExpenseCreateReceiptFormDialog />
                  <ExpenseCreateReceiptFormDialog vat />
                </>
              )}
              {selectedEntry && <ExpenseAddEntryFormDialog update />}
            </div>
          </ExpenseCreateEntryTable>
        </div>
      </div>
    </section>
  );
}
