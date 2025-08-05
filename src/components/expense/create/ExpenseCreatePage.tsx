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
import { ClipboardList, Store, Trash } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import ExpenseCreateReceiptSummary from "./ExpenseCreateReceiptSummary";
import ExpenseCreateReceiptFormTab from "./ExpenseCreateReceiptForm/ExpenseCreateReceiptFormCard";
import ExpenseCreateBillHeader from "../ExpenseCreateBillHeader";

export default function ExpenseCreatePage() {
  const { selectedEntry, handleDeleteCreateEntry, resetCreateReceiptForm } =
    useContext(ExpenseContext) as ExpenseContextType;

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
    <section className="flex flex-col items-center p-2">
      <div className="flex w-full p-2">
        <div className="flex-1 flex gap-2">
          <Link className="" href={`/expense/${branch}/summary`} passHref>
            <Button variant="outline">
              <ClipboardList />
              รายงานบิลค่าใช้จ่าย
            </Button>
          </Link>
          <Link className="" href={`/expense`} passHref>
            <Button variant="outline">
              <Store />
              เลือกสาขา
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-wider">{`สร้างบิลค่าใช้จ่ายบริษัท ${branchName}`}</h1>
        <div className="flex-1 flex justify-end gap-2"></div>
      </div>

      <div className="flex w-full justify-center h-[80vh]">
        <div className="p-2 h-full">
          <ExpenseCreateReceiptFormTab />
        </div>
        <div className="p-2 flex flex-col gap-2 h-full">
          <ExpenseCreateEntryTable
            columnVisibility={defaultCreateEntryColumnVisibility}
            paginationPageSize={10}
          >
            <div className="flex flex-1 justify-start items-center gap-2">
              <h2 className="text-xl pr-2">
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
          <div className="flex p-4 h-fit justify-end mr-8">
            <ExpenseCreateReceiptSummary />
          </div>
        </div>
      </div>
    </section>
  );
}
