"use client";

import { useCallback, useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";

import { UUID } from "@/lib/types/models";
import {
  defaultExpenseVoucherColumnVisibility,
  expenseVoucherColumn,
} from "./ExpenseVoucherColumn";
import { createClient } from "@/lib/supabase/client";
import { getMonthBasedOn10th } from "@/lib/utils";

type ExpenseReceiptTableProps = {
  children?: React.ReactNode;
  columnVisibility: typeof defaultExpenseVoucherColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseVoucherTable({
  children,
  columnVisibility,
  paginationPageSize,
}: ExpenseReceiptTableProps) {
  const {
    expenseVouchers,
    setExpenseVouchers,
    totalVouchers,
    setTotalVouchers,
    setSelectedVoucher,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  const supabase = createClient();

  const getVouchers = useCallback(
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
        .select("*", {
          count: "exact",
        })
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
        setExpenseVouchers(data);
      }
      if (count) setTotalVouchers(count);
    },
    [setExpenseVouchers, setTotalVouchers, supabase]
  );

  useEffect(() => {
    getVouchers(branch);
  }, [branch, getVouchers]);

  let newVouchers = expenseVouchers.map((obj) => {
    const taxOnly = (obj.total_amount - obj.discount) * (obj.vat / 100);
    const withholdingOnly =
      (obj.total_amount - obj.discount) * (obj.withholding / 100);
    const totalNet =
      obj.total_amount - obj.discount + taxOnly - withholdingOnly;
    return {
      ...obj,
      receipt_number: obj.receipt_number.slice(-13),
      totalNet: totalNet,
      voucherId: "",
    };
  });

  const currentDate = getMonthBasedOn10th();
  const voucherMM = currentDate
    .toLocaleDateString("th-TH", { month: "2-digit" })
    .slice(-2);
  const voucherYY = currentDate
    .toLocaleDateString("th-TH", {
      year: "2-digit",
    })
    .slice(-2);

  let index = 1;
  newVouchers = newVouchers.map((voucher) => {
    const shouldAddIndex =
      voucher.payment_uuid !== "e98a3376-9b5d-40f1-89be-298d5b99fcef"; // คืนเงินกรรมการ
    return shouldAddIndex
      ? {
          ...voucher,
          voucherId:
            "PV" + voucherYY + voucherMM + String(index++).padStart(3, "0"),
        }
      : voucher;
  });

  newVouchers = newVouchers.map((voucher) => {
    const shouldAddIndex =
      voucher.payment_uuid === "e98a3376-9b5d-40f1-89be-298d5b99fcef"; // คืนเงินกรรมการ
    return shouldAddIndex
      ? {
          ...voucher,
          voucherId:
            "PV" + voucherYY + voucherMM + String(index).padStart(3, "0"),
        }
      : voucher;
  });

  newVouchers.sort((a, b) => a.voucherId.localeCompare(b.voucherId));

  return (
    <div className="h-full">
      {!!expenseVouchers && (
        <DataTable
          tableName="expenseVoucher"
          columns={expenseVoucherColumn}
          data={newVouchers}
          total={totalVouchers}
          setSelectedRow={setSelectedVoucher}
          initialState={{
            columnVisibility: columnVisibility,
            pagination: { pageIndex: 0, pageSize: paginationPageSize },
          }}
          totalAmountKey={[]}
          exportButton
        >
          {children}
        </DataTable>
      )}
    </div>
  );
}
