"use client";

import { useCallback, useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/common/DataTable";
import {
  defaultReceiptEntryColumnVisibility,
  expenseEntryColumn,
} from "./ExpenseEntryColumn";
import ExpenseUpdateReceiptButton from "./ExpenseUpdateReceiptButton";
import ExpenseDeleteReceiptButton from "./ExpenseDeleteReceiptButton";

type ExpenseEntryTableProps = {
  columnVisibility: typeof defaultReceiptEntryColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseEntryTable({
  columnVisibility,
  paginationPageSize,
}: ExpenseEntryTableProps) {
  const {
    totalEntry,
    setTotalEntry,
    receiptEntries,
    setReceiptEntries,
    selectedReceipt,
    setSelectedEntry,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const supabase = createClient();

  const getExpenseEntry = useCallback(
    async function () {
      const query = supabase
        .from("expense_entry")
        .select("*, expense_item(*, expense_category(*))", { count: "exact" })
        .eq("receipt_uuid", selectedReceipt?.receipt_uuid)
        .order("entry_uuid", { ascending: true })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setReceiptEntries(data);
      }
      if (count) setTotalEntry(count);
    },
    [selectedReceipt, setReceiptEntries, setTotalEntry, supabase]
  );

  useEffect(() => {
    if (selectedReceipt) {
      getExpenseEntry();
    }
  }, [getExpenseEntry, selectedReceipt, setReceiptEntries]);

  return (
    <div className="h-full">
      {selectedReceipt && (
        <DataTable
          tableName="receiptEntries"
          columns={expenseEntryColumn}
          data={receiptEntries}
          total={totalEntry}
          setSelectedRow={setSelectedEntry}
          initialState={{
            columnVisibility: columnVisibility,
            pagination: { pageIndex: 0, pageSize: paginationPageSize },
          }}
          totalAmountKey={[]}
        >
          <h2 className="flex-1">
            <div className="flex gap-4 items-center">
              <div>
                <div
                  className={`flex gap-3 items-center ${
                    selectedReceipt.receipt_number ? "text-sm" : "text-xl"
                  }`}
                >
                  <div className="font-bold">
                    {selectedReceipt.supplier?.supplier_code}
                  </div>
                  <div>{selectedReceipt.supplier?.supplier_name}</div>
                </div>
                <div className="text-xl italic">
                  {selectedReceipt.receipt_number}
                </div>
              </div>
              <ExpenseUpdateReceiptButton />
              <ExpenseDeleteReceiptButton />
            </div>
          </h2>
        </DataTable>
      )}
    </div>
  );
}
