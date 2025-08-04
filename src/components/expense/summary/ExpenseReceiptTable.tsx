"use client";

import { useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";
import { expenseReceiptColumn } from "./ExpenseReceiptColumn";
import { UUID } from "@/lib/types/models";

export const defaultExpenseReceiptColumnVisibility = {
  รายการเลขที่: false,
  บริษัท: true,
  เลขที่ใบแจ้งหนี้: false,
  วันที่ใบแจ้งหนี้: false,
  เลขที่ใบกำกับภาษี: true,
  วันที่ใบกำกับภาษี: true,
  เลขที่ใบเสร็จรับเงิน: false,
  วันที่ใบเสร็จรับเงิน: false,
  จำนวนเงิน: true,
  ชำระโดย: true,
  หมายเหตุ: false,
  สาขา: true,
  พนักงาน: false,
};

type ExpenseReceiptTableProps = {
  children?: React.ReactNode;
  columnVisibility: typeof defaultExpenseReceiptColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseReceiptTable({
  children,
  columnVisibility,
  paginationPageSize,
}: ExpenseReceiptTableProps) {
  const {
    expenseReceipts,
    setSubmitError,
    totalReceipt,
    setSelectedReceipt,
    getExpense,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  useEffect(() => {
    setSubmitError(undefined);
    getExpense(branch);
  }, [branch, getExpense, setSubmitError]);

  return (
    <div className="h-full">
      {!!expenseReceipts && (
        <DataTable
          tableName="expenseReceipt"
          columns={expenseReceiptColumn}
          data={expenseReceipts}
          total={totalReceipt}
          setSelectedRow={setSelectedReceipt}
          initialState={{
            columnVisibility: columnVisibility,
            pagination: { pageIndex: 0, pageSize: paginationPageSize },
          }}
          totalAmountKey={[]}
        >
          {children}
        </DataTable>
      )}
    </div>
  );
}
