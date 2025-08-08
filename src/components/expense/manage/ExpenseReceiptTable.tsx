"use client";

import { useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";
import {
  defaultExpenseReceiptColumnVisibility,
  expenseReceiptColumn,
} from "./ExpenseReceiptColumn";
import { UUID } from "@/lib/types/models";

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
