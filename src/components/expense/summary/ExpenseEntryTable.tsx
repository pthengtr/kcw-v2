"use client";

import { useCallback, useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/common/DataTable";
import { expenseEntryColumn } from "./ExpenseEntryColumn";

export const defaultReceiptEntryColumnVisibility = {
  รายการเลขที่: false,
  อ้างอิงจากใบกำกับ: false,
  อ้างอิงประเภทค่าใช้จ่าย: false,
  ราคาต่อหน่วย: true,
  จำนวน: true,
  รายละเอียด: true,
  จำนวนรวม: true,
};

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
        .select("*, expense_item(*)", { count: "exact" })
        .eq("receipt_id", selectedReceipt?.receipt_id)
        .order("entry_id", { ascending: true })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      console.log(data);
      if (data) {
        setReceiptEntries(data);
      }
      if (count) setTotalEntry(count);
    },
    [selectedReceipt?.receipt_id, setReceiptEntries, setTotalEntry, supabase]
  );

  useEffect(() => {
    if (selectedReceipt) getExpenseEntry();
  }, [getExpenseEntry, selectedReceipt]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="h-full">
        {!!receiptEntries && (
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
            totalAmountKey={["ราคารวม"]}
          >
            <h2 className="text-2xl font-bold flex-1">
              รายละเอียดค่าใช้จ่าย {selectedReceipt?.invoice_number}
            </h2>
          </DataTable>
        )}
      </div>
    </div>
  );
}
