"use client";

import { useCallback, useContext, useEffect } from "react";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";

import { UUID } from "@/lib/types/models";

import { createClient } from "@/lib/supabase/client";
import {
  defaultTaxReportColumnVisibility,
  taxReportColumn,
} from "./TaxReportColumn";
import { BILL_CYCLE_DATE, getMonthBasedOn10th } from "@/lib/utils";
import ExpenseUpdateReceiptButton from "../manage/ExpenseUpdateReceiptButton";
import TaxReportSearchForm from "./TaxReportSearchForm";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import CommonImageManagerDialog from "@/components/common/CommonImageManagerDialog";
import { Button } from "@/components/ui/button";

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
    setExpenseTaxReport,
    expenseTaxReport,
    setSelectedTaxReport,
    selectedTaxReport,
    setTotalTaxReport,
    totalTaxReport,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  const supabase = createClient();

  const getTaxReceipt = useCallback(
    async function (branchParam: UUID) {
      const date = getMonthBasedOn10th();

      // 10th of the same month
      const fromDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        BILL_CYCLE_DATE
      ).toISOString();

      // 10th of the next month
      const toDate = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        BILL_CYCLE_DATE
      ).toISOString();

      const { data, error } = await supabase.rpc("fn_tax_report", {
        from_date: fromDate,
        to_date: toDate,
        in_branch: branchParam === "all" ? null : branchParam,
        limit_count: 500,
        offset_count: 0,
      });

      if (error) {
        console.error(error);
        return;
      }

      if (data && data.length > 0) {
        setExpenseTaxReport(data); // keep context flexible or change context type to TaxReportRow[]
        setTotalTaxReport(data[0].total_count ?? data.length);
      } else {
        setExpenseTaxReport([]);
        setTotalTaxReport(0);
      }
    },
    [setExpenseTaxReport, setTotalTaxReport, supabase]
  );

  useEffect(() => {
    getTaxReceipt(branch);
  }, [branch, getTaxReceipt]);

  return (
    <div className="h-full">
      {!!expenseTaxReport && (
        <DataTable
          tableName="expenseVoucher"
          columns={taxReportColumn}
          data={expenseTaxReport}
          total={totalTaxReport}
          setSelectedRow={setSelectedTaxReport}
          initialState={{
            columnVisibility: columnVisibility,
            pagination: { pageIndex: 0, pageSize: paginationPageSize },
          }}
          totalAmountKey={[]}
          exportButton
        >
          <div className="flex items-center justify-start w-full">
            <h2 className="px-4 text-xl font-bold tracking-wider">
              รายงานภาษีซื้อ
            </h2>

            <div>
              <TaxReportSearchForm
                defaultValues={{
                  tax_report_month: getMonthBasedOn10th().toString(),
                }}
              />
            </div>

            <div className="flex-1 flex justify-end items-center gap-4">
              {selectedTaxReport && (
                <>
                  <CommonImageManagerDialog
                    receiptUuid={selectedTaxReport.receipt_uuid}
                    folder="public/expense_receipts"
                    bucket="pictures"
                    makePublicUrl
                    trigger={
                      <Button variant="outline" size="sm">
                        อัปโหลด/ดูรูป
                      </Button>
                    }
                  />
                  <ExpenseUpdateReceiptButton
                    receipt_uuid={selectedTaxReport.receipt_uuid}
                    size="sm"
                  />
                </>
              )}
            </div>
          </div>
        </DataTable>
      )}
    </div>
  );
}
