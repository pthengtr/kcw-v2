"use client";

import ExpenseAddEntryFormDialog from "@/components/expense/create/ExpenseAddEntryForm/ExpenseAddEntryFormDialog";
import ExpenseCreateEntryTable, {
  defaultCreateEntryColumnVisibility,
} from "@/components/expense/create/ExpenseCreateEntryTable";
import {
  ExpenseContext,
  ExpenseContextType,
} from "@/components/expense/ExpenseProvider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Trash } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import ExpenseCreateReceiptSummary from "./ExpenseCreateReceiptSummary";
import ExpenseCreateReceiptFormCard from "./ExpenseCreateReceiptForm/ExpenseCreateReceiptFormCard";
import ExpenseCreateBillHeader from "../ExpenseCreateBillHeader";
import ExpensePageHeader from "../ExpensePageHeader";
import { LocalImageDropzone } from "@/components/common/LocalImageDropzone";

export default function ExpenseCreatePage() {
  const {
    selectedEntry,
    handleDeleteCreateEntry,
    resetCreateReceiptForm,
    pendingFiles,
    setPendingFiles,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const pathName = usePathname();

  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

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
    <section className="flex flex-col items-center gap-4 p-2 sm:p-4">
      <ExpensePageHeader
        pageTitle={
          pathName.includes("/credit-note")
            ? `สร้างใบลดหนี้บริษัท ${branchName}`
            : `สร้างบิลค่าใช้จ่ายบริษัท ${branchName}`
        }
      />
      <div className="flex h-auto w-full min-w-0 flex-col justify-center gap-4 md:h-[80vh] md:flex-row">
        <div className="flex h-full min-w-0 flex-col gap-4 p-2 md:w-auto">
          <ExpenseCreateReceiptFormCard />
          <LocalImageDropzone
            value={pendingFiles}
            onChange={setPendingFiles}
            multiple
          />
        </div>
        <div className="flex h-full min-w-0 flex-col gap-2 p-2 md:w-auto">
          <ExpenseCreateEntryTable
            columnVisibility={defaultCreateEntryColumnVisibility}
            paginationPageSize={10}
          >
            <div className="flex flex-1 flex-wrap items-center justify-start gap-2">
              <h2 className="pr-2 text-lg sm:text-xl">
                <ExpenseCreateBillHeader />
              </h2>
              <ExpenseAddEntryFormDialog />
              {selectedEntry && (
                <>
                  <ExpenseAddEntryFormDialog update />
                  <Button
                    onClick={() =>
                      handleDeleteCreateEntry(selectedEntry.entry_uuid)
                    }
                  >
                    <Trash />
                  </Button>
                </>
              )}
            </div>
          </ExpenseCreateEntryTable>
          <div className="mr-0 flex h-fit justify-end p-2 sm:mr-8 sm:p-4">
            <ExpenseCreateReceiptSummary />
          </div>
        </div>
      </div>
    </section>
  );
}
