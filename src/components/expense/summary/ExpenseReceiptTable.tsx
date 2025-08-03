"use client";

import { useCallback, useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";
import { expenseReceiptColumn } from "./ExpenseReceiptColumn";

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
    setExpenseReceipts,
    setSubmitError,
    totalReceipt,
    setTotalReceipt,
    setSelectedReceipt,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: string } = useParams();

  const supabase = createClient();

  const getExpense = useCallback(
    async function () {
      let query = supabase
        .from("expense_receipt")
        .select("*, supplier(*), branch(*), payment_method(*)", {
          count: "exact",
        })
        .order("receipt_uuid", { ascending: false })
        .limit(500);

      if (branch !== "all") {
        query = query.eq("branch_uuid", branch);
      }

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setExpenseReceipts(data);
      }
      if (count) setTotalReceipt(count);
    },
    [branch, setExpenseReceipts, setTotalReceipt, supabase]
  );

  useEffect(() => {
    setSubmitError(undefined);
    getExpense();
  }, [getExpense, setSubmitError]);

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
