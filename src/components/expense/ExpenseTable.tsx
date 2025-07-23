"use client";

import { useCallback, useContext, useEffect } from "react";
import ExpenseFormDialog from "./ExpenseFormDialog";
import { branchLabel, expenseFormDefaultValue } from "./ExpenseForm";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { DataTable } from "../common/DataTable";
import { expenseColumn } from "./ExpenseColumn";
import { createClient } from "@/lib/supabase/client";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";
import ExpenseSearchForm from "./ExpenseSearchForm";

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
    openCreateDialog,
    setOpenCreateDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  function handleSelectedRow() {}

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
        query = query.ilike("branch_name", branch);
      }

      const { data, error, count } = await query;

      console.log(data);

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
        <div className="flex justify-end">
          <ExpenseFormDialog
            open={openCreateDialog}
            setOpen={setOpenCreateDialog}
            dialogTrigger={<Plus />}
            dialogHeader={`เพิ่มรายการค่าใช้จ่าย สาขา${
              branchLabel[branch] as keyof typeof branchLabel
            }`}
            defaultValues={expenseFormDefaultValue}
          />
        </div>
      </div>

      <div className="h-full">
        {!!expenses && (
          <DataTable
            tableName="expense"
            columns={expenseColumn}
            data={expenses}
            total={total}
            setSelectedRow={handleSelectedRow}
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
