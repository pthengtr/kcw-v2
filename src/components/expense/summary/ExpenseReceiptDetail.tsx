"use client";
import { useContext } from "react";
import ExpenseCommonReceiptSummary from "../ExpenseCommonReceiptSummary";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpenseEntryTable, {
  defaultReceiptEntryColumnVisibility,
} from "./ExpenseEntryTable";
import ExpenseCommonReceiptSummaryDebug from "../ExpenseCommonReceiptSummaryDebug";

export default function ExpenseSummaryDetail() {
  const { receiptEntries, selectedReceipt } = useContext(
    ExpenseContext
  ) as ExpenseContextType;
  return (
    <div className="flex flex-col gap-4">
      <ExpenseEntryTable
        columnVisibility={defaultReceiptEntryColumnVisibility}
        paginationPageSize={10}
      />
      {selectedReceipt && (
        <div className="self-end flex gap-4">
          <div className="grid grid-cols-2 gap-2  p-8 border rounded-md">
            <ExpenseCommonReceiptSummaryDebug
              selectedReceipt={selectedReceipt}
            />
          </div>
          <div className="grid grid-cols-2 gap-2  p-8 border rounded-md">
            <ExpenseCommonReceiptSummary
              entries={receiptEntries}
              vatInput={selectedReceipt.vat}
              discountInput={selectedReceipt.discount}
              withholdingInput={selectedReceipt.withholding}
            />
          </div>
        </div>
      )}
    </div>
  );
}
