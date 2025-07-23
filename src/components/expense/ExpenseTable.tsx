"use client";

import { useCallback, useEffect, useState } from "react";
import ExpenseFormDialog from "./ExpenseFormDialog";
import { branchLabel, expenseFormDefaultValue } from "./ExpenseForm";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { DataTable } from "../common/DataTable";
import { expenseColumn, ExpenseType } from "./ExpenseColumn";
import { VisibilityState } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";

export default function ExpenseTable() {
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseType[] | undefined>([]);
  const [total, setTotal] = useState<number | undefined>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [paginationPageSize, setPaginationPageSize] = useState<number>(10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [submitError, setSubmitError] = useState<string | undefined>();

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

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setExpenses(data);
      }
      if (count) setTotal(count);
    },
    [branch, supabase]
  );

  useEffect(() => {
    setSubmitError(undefined);
    getReminder();
  }, [getReminder]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-center items-center p-4 gap-4">
        {/* <div>
            <ReminderSearchForm
              defaultValues={{
                search_supplier_name: "",
                note_id: "",
                due_month: "all",
                payment_month: "all",
              }}
            />
          </div> */}
        <div className="flex justify-end">
          <ExpenseFormDialog
            open={open}
            setOpen={setOpen}
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
            columns={expenseColumn}
            data={expenses}
            total={total}
            setSelectedRow={handleSelectedRow}
            initialState={{
              columnVisibility: columnVisibility,
              pagination: { pageIndex: 0, pageSize: paginationPageSize },
            }}
            totalAmountKey={[]}
          >
            <div className="flex gap-4 mr-auto px-8">
              <h2 className="text-2xl font-bold flex-1">{`รายการค่าใช้จ่าย สาขา${
                branchLabel[branch] as keyof typeof branchLabel
              }`}</h2>
            </div>
          </DataTable>
        )}
      </div>
    </div>
  );
}
