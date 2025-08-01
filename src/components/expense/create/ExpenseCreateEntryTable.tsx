"use client";

import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { DataTable } from "@/components/common/DataTable";
import { expenseEntryColumn } from "../summary/ExpenseEntryColumn";

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
};

export default function ExpenseCreateEntryTable({
  children,
  columnVisibility,
  paginationPageSize,
}: ExpenseEntryTableProps) {
  const { createEntries, setSelectedEntry } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

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
        totalAmountKey={["ราคารวม"]}
      >
        {children}
      </DataTable>
    </div>
  );
}
