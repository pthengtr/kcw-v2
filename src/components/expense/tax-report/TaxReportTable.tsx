"use client";

import { useCallback, useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";

import { UUID } from "@/lib/types/models";

import { createClient } from "@/lib/supabase/client";
import {
  defaultTaxReportColumnVisibility,
  taxReportColumn,
} from "./TaxReportColumn";
import { getMonthBasedOn10th } from "@/lib/utils";

type ExpenseReceiptTableProps = {
  children?: React.ReactNode;
  columnVisibility: typeof defaultTaxReportColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function TaxReportTable({
  columnVisibility,
  paginationPageSize,
}: ExpenseReceiptTableProps) {
  const {
    expenseReceipts,
    setExpenseReceipts,
    setTotalReceipt,
    totalReceipt,
    setSelectedReceipt,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  const supabase = createClient();

  const getTaxReceipt = useCallback(
    async function (branch: UUID) {
      const date = getMonthBasedOn10th();
      // 10th of the same month
      const fromDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        10
      ).toLocaleString("en-US");

      // 10th of the next month
      const toDate = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        10
      ).toLocaleString("en-US");

      let query = supabase
        .from("expense_receipt")
        .select(
          "*, supplier(*, supplier_tax_info(*)), branch(*), payment_method(*)",
          {
            count: "exact",
          }
        )
        .gt("vat", 0)
        .order("receipt_date", { ascending: true })
        .gte("created_at", fromDate)
        .lte("created_at", toDate)
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
    [setExpenseReceipts, setTotalReceipt, supabase]
  );

  useEffect(() => {
    getTaxReceipt(branch);
  }, [branch, getTaxReceipt]);

  return (
    <div className="h-full">
      {!!expenseReceipts && (
        <DataTable
          tableName="expenseVoucher"
          columns={taxReportColumn}
          data={expenseReceipts}
          total={totalReceipt}
          setSelectedRow={setSelectedReceipt}
          initialState={{
            columnVisibility: columnVisibility,
            pagination: { pageIndex: 0, pageSize: paginationPageSize },
          }}
          totalAmountKey={[]}
          exportButton
        >
          <div className="flex items-baseline justify-start w-full">
            <h2 className="p-2 text-xl font-bold tracking-wider">
              รายงานภาษีซื้อ
            </h2>
          </div>
        </DataTable>
      )}
    </div>
  );
}
