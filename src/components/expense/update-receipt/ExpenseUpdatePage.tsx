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
          <div className="flex w-full p-2">
            <div className="flex-1 flex gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowBigLeftDash strokeWidth={1} />
                กลับ
              </Button>
              {/* </Link> */}
            </div>
            <h1 className="text-2xl font-bold tracking-wider">
              {selectedRefReceipt
                ? `แก้ไขใบลดหนี้ ${branchName}`
                : `แก้ไขบิลค่าใชัจ่าย ${branchName}`}
            </h1>
            <div className="flex-1 flex justify-end gap-2"></div>
          </div>

          <div className="flex w-full justify-center h-[80vh]">
            <div className="p-2 h-full flex flex-col gap-4">
              <ExpenseCreateReceiptFormCard update />
              <LocalImageDropzone
                value={pendingFiles}
                onChange={setPendingFiles}
                multiple
              />
            </div>
            <div className="p-2 flex flex-col gap-2 h-full">
              <ExpenseCreateEntryTable
                columnVisibility={defaultCreateEntryColumnVisibility}
                paginationPageSize={10}
                update
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
