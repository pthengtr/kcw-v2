"use client";

import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { DataTable } from "@/components/common/DataTable";
import { expenseEntryColumn } from "../summary/ExpenseEntryColumn";
import ExpenseAddEntryFormDialog from "./ExpenseAddEntryFormDialog";
import ExpenseCreateReceiptFormDialog from "./ExpenseCreateReceiptFormDialog";

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
  columnVisibility: typeof defaultCreateEntryColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseCreateEntryTable({
  columnVisibility,
  paginationPageSize,
}: ExpenseEntryTableProps) {
  const { createEntries, setSelectedEntry, selectedEntry } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex gap-2 justify-center">
        {createEntries.length > 0 && (
          <>
            <ExpenseCreateReceiptFormDialog />
            <ExpenseCreateReceiptFormDialog vat />
          </>
        )}
        {selectedEntry && <ExpenseAddEntryFormDialog update />}
      </div>

      <div className="h-full">
        {createEntries.length > 0 && (
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
            totalAmountKey={["ราคารวม"]}
          >
            <div className="flex gap-4 mr-auto px-8">
              <h2 className="text-2xl font-bold flex-1"></h2>
            </div>
          </DataTable>
        )}
      </div>
    </div>
  );
}
