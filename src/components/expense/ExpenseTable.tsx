"use client";

import { useCallback, useContext, useEffect } from "react";
import ExpenseFormDialog from "./ExpenseFormDialog";
import {
  branchLabel,
  expenseFormDefaultValue,
  expenseFormNoVatDefaultValue,
} from "./ExpenseForm";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { DataTable } from "../common/DataTable";
import { expenseColumn } from "./ExpenseColumn";
import { createClient } from "@/lib/supabase/client";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";
import ExpenseSearchForm from "./ExpenseSearchForm";
import { Button } from "../ui/button";
import ExpenseUpdateFormDialog from "./ExpenseUpdateFormDialog";

export const defaultColumnVisibility = {
  รายการเลขที่: false,
  สร้าง: false,
  "ชื่อร้าน/บริษัท": true,
  "เลขที่ใบกำกับ/ใบแจ้งหนี้": true,
  เลขที่ใบเสร็จรับเงิน: true,
  ประเภทบัญชี: true,
  รายละเอียด: true,
  "จำนวนเงิน (หักส่วนลดแล้ว)": true,
  วันที่ชำระ: true,
  วิธีการชำระ: true,
  สาขา: false,
  หมายเหตุ: false,
  แก้ไขล่าสุด: false,
  " ": false,
};

type ExpenseTableProps = {
  columnVisibility: typeof defaultColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseTable({
  columnVisibility,
  paginationPageSize,
}: ExpenseTableProps) {
  const {
    expenses,
    setExpenses,
    setSubmitError,
    total,
    setTotal,
    openCreateVatDialog,
    setOpenCreateVatDialog,
    openCreateNoVatDialog,
    setOpenCreateNoVatDialog,
    setSelectedRow,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: keyof typeof branchLabel } = useParams();

  const supabase = createClient();

  const getReminder = useCallback(
    async function () {
      let query = supabase
        .from("expense")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .limit(500);

      if (branch !== "all") {
        query = query.ilike("branch_name", branchLabel[branch]);
      }

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setExpenses(data);
      }
      if (count) setTotal(count);
    },
    [branch, setExpenses, setTotal, supabase]
  );

  useEffect(() => {
    setSubmitError(undefined);
    getReminder();
  }, [getReminder, setSubmitError]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-center items-center p-4 gap-4">
        <div>
          <ExpenseSearchForm
            defaultValues={{
              company_name: "",
              payment_month: "all",
            }}
          />
        </div>
        {branch !== "all" && (
          <div className="flex justify-end gap-4">
            <ExpenseFormDialog
              open={openCreateNoVatDialog}
              setOpen={setOpenCreateNoVatDialog}
              dialogTrigger={
                <Button id="create-expense-novat">
                  <Plus /> ทั่วไป
                </Button>
              }
              dialogHeader={`เพิ่มรายการค่าใช้จ่ายทั่วไป ${
                branchLabel[branch] as keyof typeof branchLabel
              }`}
              defaultValues={expenseFormNoVatDefaultValue}
            />
            <ExpenseFormDialog
              open={openCreateVatDialog}
              setOpen={setOpenCreateVatDialog}
              dialogTrigger={
                <Button id="create-expense-vat">
                  <Plus /> บริษัท
                </Button>
              }
              dialogHeader={`เพิ่มรายการค่าใช้จ่ายบริษัท ${
                branchLabel[branch] as keyof typeof branchLabel
              }`}
              defaultValues={expenseFormDefaultValue}
            />
            <ExpenseUpdateFormDialog />
          </div>
        )}
      </div>

      <div className="h-full">
        {!!expenses && (
          <DataTable
            tableName="expense"
            columns={expenseColumn}
            data={expenses}
            total={total}
            setSelectedRow={setSelectedRow}
            initialState={{
              columnVisibility: columnVisibility,
              pagination: { pageIndex: 0, pageSize: paginationPageSize },
            }}
            totalAmountKey={["จำนวนเงิน"]}
          >
            <div className="flex gap-4 mr-auto px-8">
              <h2 className="text-2xl font-bold flex-1">{`รายการค่าใช้จ่าย ${
                branchLabel[branch] as keyof typeof branchLabel
              }`}</h2>
            </div>
          </DataTable>
        )}
      </div>
    </div>
  );
}
