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
import { useParams, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import ExpenseCreateReceiptFormTab from "../create/ExpenseCreateReceiptForm/ExpenseCreateReceiptFormTab";
import ExpenseCreateReceiptSummary from "../create/ExpenseCreateReceiptSummary";
import { ExpenseReceiptType } from "@/lib/types/models";

export default function ExpenseUpdatePage() {
  const {
    selectedEntry,
    selectedReceipt,
    setSelectedReceipt,
    handleDeleteCreateEntry,
    setCreateReceiptTab,
    setVatInput,
    setDiscountInput,
    setWithholdingInput,
    setSelectedPaymentMethod,
    setSelectedSupplier,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  const searchParams = useSearchParams();
  const receiptId = searchParams.get("receipt-id");

  useEffect(() => {
    const supabase = createClient();

    async function getBranchName() {
      const query = supabase
        .from("branch")
        .select("*")
        .eq("branch_uuid", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    async function getReceipt() {
      const query = supabase
        .from("expense_receipt")
        .select("*, supplier(*), payment_method(*)")
        .eq("receipt_uuid", receiptId)
        .overrideTypes<ExpenseReceiptType[], { merge: false }>();

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) {
        const [receipt] = data;
        setSelectedReceipt(receipt);
        setVatInput(receipt.vat.toString());
        setDiscountInput(receipt.discount.toString());
        setWithholdingInput(receipt.withholding.toString());
        if (receipt.submit_to_account) {
          setCreateReceiptTab("company");
        } else {
          setCreateReceiptTab("individual");
        }
        setSelectedSupplier(receipt.supplier);
        setSelectedPaymentMethod(receipt.payment_method);
      }
    }

    getBranchName();
    getReceipt();
  }, [
    branch,
    receiptId,
    setCreateReceiptTab,
    setDiscountInput,
    setSelectedPaymentMethod,
    setSelectedReceipt,
    setSelectedSupplier,
    setVatInput,
    setWithholdingInput,
  ]);

  return (
    <>
      {selectedReceipt && (
        <section className="flex flex-col items-center p-2">
          <div className="flex w-full p-2">
            <div className="flex-1 flex gap-2"></div>
            <h1 className="text-2xl font-bold tracking-wider">{`แก้ไขบิลค่าใชัจ่าย ${branchName}`}</h1>
            <div className="flex-1 flex justify-end gap-2"></div>
          </div>

          <div className="flex w-full justify-center h-[80vh]">
            <div className="p-2 h-full">
              <ExpenseCreateReceiptFormTab update />
            </div>
            <div className="p-2 flex flex-col gap-2 h-full">
              <ExpenseCreateEntryTable
                columnVisibility={defaultCreateEntryColumnVisibility}
                paginationPageSize={10}
                update
              >
                <div className="flex flex-1 justify-start items-center gap-2">
                  <h2 className="text-xl font-bold pr-2">บิลค่าใช้จ่ายใหม่</h2>
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
      )}
    </>
  );
}
