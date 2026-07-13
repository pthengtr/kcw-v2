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
import { ArrowBigLeftDash, Trash } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import ExpenseCreateReceiptFormCard from "../create/ExpenseCreateReceiptForm/ExpenseCreateReceiptFormCard";
import ExpenseCreateReceiptSummary from "../create/ExpenseCreateReceiptSummary";
import { ExpenseReceiptType } from "@/lib/types/models";
import ExpenseCreateBillHeader from "../ExpenseCreateBillHeader";
import { LocalImageDropzone } from "@/components/common/LocalImageDropzone";

export default function ExpenseUpdatePage() {
  const {
    selectedEntry,
    selectedReceipt,
    setSelectedReceipt,
    handleDeleteCreateEntry,
    setVatInput,
    setDiscountInput,
    setWithholdingInput,
    setSelectedPaymentMethod,
    setSelectedSupplier,
    setDeleteEntries,
    setReceiptNumber,
    setTaxExemptInput,
    setSelectedRefReceipt,
    selectedRefReceipt,
    pendingFiles,
    setPendingFiles,
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
        .select(
          "*, party(*), payment_method(*), expense_receipt:ref_receipt_uuid (*)"
        )
        .eq("receipt_uuid", receiptId)
        .overrideTypes<ExpenseReceiptType[], { merge: false }>();

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) {
        const [receipt] = data;
        setDeleteEntries([]);
        setSelectedReceipt(receipt);
        setReceiptNumber(receipt.receipt_number);
        setVatInput(receipt.vat.toString());
        setDiscountInput(receipt.discount.toString());
        setWithholdingInput(receipt.withholding.toString());
        setTaxExemptInput(receipt.tax_exempt.toString());
        setSelectedSupplier(receipt.party);
        setSelectedPaymentMethod(receipt.payment_method);
        setSelectedRefReceipt(receipt.expense_receipt);
      }
    }

    getBranchName();
    getReceipt();
  }, [
    branch,
    receiptId,
    setDeleteEntries,
    setDiscountInput,
    setReceiptNumber,
    setSelectedPaymentMethod,
    setSelectedReceipt,
    setSelectedRefReceipt,
    setSelectedSupplier,
    setTaxExemptInput,
    setVatInput,
    setWithholdingInput,
  ]);

  const router = useRouter();
  return (
    <>
      {selectedReceipt && (
        <section className="flex flex-col items-center p-2">
          <div className="flex w-full min-w-0 flex-col gap-2 p-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowBigLeftDash strokeWidth={1} />
                กลับ
              </Button>
            </div>
            <h1 className="min-w-0 break-words text-center text-lg font-bold tracking-wider sm:text-2xl">
              {selectedRefReceipt
                ? `แก้ไขใบลดหนี้ ${branchName}`
                : `แก้ไขบิลค่าใชัจ่าย ${branchName}`}
            </h1>
            <div className="hidden flex-1 justify-end gap-2 sm:flex"></div>
          </div>

          <div className="flex h-auto w-full min-w-0 flex-col justify-center gap-4 md:h-[80vh] md:flex-row">
            <div className="flex h-full min-w-0 flex-col gap-4 p-2">
              <ExpenseCreateReceiptFormCard update />
              <LocalImageDropzone
                value={pendingFiles}
                onChange={setPendingFiles}
                multiple
              />
            </div>
            <div className="flex h-full min-w-0 flex-col gap-2 p-2">
              <ExpenseCreateEntryTable
                columnVisibility={defaultCreateEntryColumnVisibility}
                paginationPageSize={10}
                update
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
                          handleDeleteCreateEntry(
                            selectedEntry.entry_uuid,
                            true
                          )
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
      )}
    </>
  );
}
