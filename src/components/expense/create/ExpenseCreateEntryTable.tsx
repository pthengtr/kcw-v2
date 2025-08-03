"use client";

import { useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { DataTable } from "@/components/common/DataTable";
import { expenseEntryColumn } from "../summary/ExpenseEntryColumn";
import { createClient } from "@/lib/supabase/client";

export const defaultCreateEntryColumnVisibility = {
  รายการเลขที่: false,
  อ้างอิงจากใบกำกับ: false,
  อ้างอิงประเภทค่าใช้จ่าย: false,
  ราคาต่อหน่วย: true,
  จำนวน: true,
  รายละเอียด: true,
  ราคารวม: true,
  ประเภทค่าใช้จ่าย: true,
  หมวด: false,
};

type ExpenseEntryTableProps = {
  children?: React.ReactNode;
  columnVisibility: typeof defaultCreateEntryColumnVisibility | undefined;
  paginationPageSize: number | undefined;
  update?: boolean;
};

export default function ExpenseCreateEntryTable({
  children,
  columnVisibility,
  paginationPageSize,
  update = false,
}: ExpenseEntryTableProps) {
  const { createEntries, setCreateEntries, setSelectedEntry, selectedReceipt } =
    useContext(ExpenseContext) as ExpenseContextType;

  useEffect(() => {
    async function getCreateEntries() {
      const supabase = createClient();

      const query = supabase
        .from("expense_entry")
        .select("*, expense_item(*)")
        .eq("receipt_uuid", selectedReceipt?.receipt_uuid);

      const { data, error } = await query;

      console.log(data, error);

      if (error) console.log(error.message);
      if (data) {
        setCreateEntries(data);
      }
    }

    if (update) {
      getCreateEntries();
    }
  }, [
    setSelectedEntry,
    setCreateEntries,
    update,
    selectedReceipt?.receipt_uuid,
  ]);

  return (
    <div className="h-full">
      <DataTable
        tableName="createEntries"
        columns={expenseEntryColumn}
        data={createEntries}
        total={createEntries.length}
        setSelectedRow={setSelectedEntry}
        initialState={{
          columnVisibility: columnVisibility,
          pagination: { pageIndex: 0, pageSize: paginationPageSize },
        }}
        totalAmountKey={[]}
      >
        {children}
      </DataTable>
    </div>
  );
}
