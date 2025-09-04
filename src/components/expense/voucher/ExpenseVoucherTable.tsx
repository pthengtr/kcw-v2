"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/common/DataTable";

import {
  ExtendedExpenseReceiptType,
  PaymentMethodType,
  UUID,
} from "@/lib/types/models";
import {
  defaultExpenseVoucherColumnVisibility,
  expenseVoucherColumn,
} from "./ExpenseVoucherColumn";
import { createClient } from "@/lib/supabase/client";
import { BILL_CYCLE_DATE, getMonthBasedOn10th } from "@/lib/utils";
import ExpenseVoucherSearchForm from "./ExpenseVoucherSearchForm";
import ExpenseVoucherPrintDialog from "./ExpenseVoucherPrintDialog";
import ExpenseUpdateReceiptButton from "../manage/ExpenseUpdateReceiptButton";
import CommonImageManagerDialog from "@/components/common/CommonImageManagerDialog";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";

type ExpenseReceiptTableProps = {
  children?: React.ReactNode;
  columnVisibility: typeof defaultExpenseVoucherColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseVoucherTable({
  columnVisibility,
  paginationPageSize,
}: ExpenseReceiptTableProps) {
  const {
    expenseVouchers,
    setExpenseVouchers,
    totalVouchers,
    setTotalVouchers,
    setSelectedVoucher,
    selectedVoucher,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  const [groupVoucher, setGroupVoucher] = useState<UUID[]>([]);
  const [skipVoucher, setSkipVoucher] = useState<UUID[]>([]);

  const supabase = createClient();

  const getVouchers = useCallback(
    async function (branch: UUID) {
      const date = getMonthBasedOn10th();
      // 10th of the same month
      const fromDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        BILL_CYCLE_DATE
      ).toLocaleString("en-US");

      // 10th of the next month
      const toDate = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        BILL_CYCLE_DATE
      ).toLocaleString("en-US");

      let query = supabase
        .from("expense_receipt")
        .select("*, party(*), branch(*), payment_method(*)", {
          count: "exact",
        })
        .neq("doc_type", "CREDIT_NOTE")
        .order("receipt_date", { ascending: true })
        .order("receipt_number", { ascending: true }) // secondary sort
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
      if (count !== null && count !== undefined) setTotalVouchers(count);
    },
    [setExpenseVouchers, setTotalVouchers, supabase]
  );

  const getPayment = useCallback(
    async function () {
      const query = supabase
        .from("payment_method")
        .select("*")
        .overrideTypes<PaymentMethodType[], { merge: false }>();

      const { data, error } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setGroupVoucher(
          data
            .filter((payment_method) => payment_method.voucher_type === "group")
            .map((payment_method) => payment_method.payment_uuid)
        );
        setSkipVoucher(
          data
            .filter((payment_method) => payment_method.voucher_type === "skip")
            .map((payment_method) => payment_method.payment_uuid)
        );
      }
    },
    [supabase]
  );

  useEffect(() => {
    getVouchers(branch);
    getPayment();
  }, [branch, getPayment, getVouchers]);

  let newVouchers = expenseVouchers.map((obj) => {
    const taxOnly =
      (obj.total_amount - obj.discount - obj.tax_exempt) * (obj.vat / 100);
    const withholdingOnly =
      (obj.total_amount - obj.discount - obj.tax_exempt) *
      (obj.withholding / 100);
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
  // remove skip type
  newVouchers = newVouchers.filter(
    (voucher) => !skipVoucher.includes(voucher.payment_uuid)
  );

  const branchPrefix =
    branch === "4975a5a1-90e6-443a-9921-c6c637f4631c" ? "3" : "";
  // assign vocher id to inidividual type
  const individualVouchers = newVouchers
    .filter((voucher) => !groupVoucher.includes(voucher.payment_uuid))
    .map((voucher) => {
      return {
        ...voucher,
        voucherId:
          branchPrefix +
          "PV" +
          voucherYY +
          voucherMM +
          String(index++).padStart(3, "0"),
      };
    });

  let groupVouchers = newVouchers.filter((voucher) =>
    groupVoucher.includes(voucher.payment_uuid)
  );

  const uniqueSuppliers = new Set(
    groupVouchers.map((voucher) => voucher.party_uuid)
  );

  uniqueSuppliers.forEach((unique_supplier_uuid) => {
    groupVouchers = groupVouchers.map((voucher) => {
      if (voucher.party_uuid === unique_supplier_uuid) {
        return {
          ...voucher,
          voucherId:
            "PV" + voucherYY + voucherMM + String(index).padStart(3, "0"),
        };
      }
      return voucher;
    });

    index++;
  });

  newVouchers = [...individualVouchers, ...groupVouchers];

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
          <div className="flex items-center justify-start w-full">
            <h2 className="p-2 text-xl font-bold tracking-wider">
              ใบสำคัญจ่าย
            </h2>

            <div className="">
              <ExpenseVoucherSearchForm
                defaultValues={{
                  voucher_month: getMonthBasedOn10th().toString(),
                }}
              />
            </div>

            <div className="flex-1 flex items-center justify-end gap-4">
              {selectedVoucher && (
                <>
                  <ExpenseUpdateReceiptButton
                    receipt_uuid={selectedVoucher.receipt_uuid}
                    size="sm"
                  />
                  <CommonImageManagerDialog
                    receiptUuid={selectedVoucher.receipt_uuid}
                    folder="public/expense_receipts"
                    bucket="pictures"
                    makePublicUrl
                    trigger={
                      <Button variant="outline" size="sm">
                        <ImageIcon />
                        อัปโหลด/ดูรูป
                      </Button>
                    }
                  />
                  <ExpenseVoucherPrintDialog
                    extendedVouchers={
                      newVouchers as ExtendedExpenseReceiptType[]
                    }
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
