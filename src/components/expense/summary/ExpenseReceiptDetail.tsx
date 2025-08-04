"use client";
import { useContext, useEffect, useState } from "react";
import ExpenseCommonReceiptSummary from "../ExpenseCommonReceiptSummary";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpenseEntryTable from "./ExpenseEntryTable";
import ExpenseCommonReceiptSummaryDebug from "../ExpenseCommonReceiptSummaryDebug";
import { getMyCookie } from "@/app/(root)/action";
import { defaultReceiptEntryColumnVisibility } from "./ExpenseEntryColumn";

export default function ExpenseSummaryDetail() {
  const { receiptEntries, selectedReceipt } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultReceiptEntryColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getMyCookieClient<T>(
      tableName: string,
      defaultValues: T,
      setValues: (values: T) => void
    ) {
      const data = await getMyCookie(tableName);
      if (data) setValues(JSON.parse(data));
      else setValues(defaultValues);
    }

    async function getCookies() {
      await getMyCookieClient(
        "receiptEntriesColumnVisibility",
        defaultReceiptEntryColumnVisibility,
        setColumnVisibility
      );
      await getMyCookieClient(
        "receiptEntriesPaginationPageSize",
        10,
        setPaginationPageSize
      );
    }

    getCookies();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ExpenseEntryTable
        columnVisibility={columnVisibility}
        paginationPageSize={paginationPageSize}
      />
      {selectedReceipt && columnVisibility && paginationPageSize && (
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
