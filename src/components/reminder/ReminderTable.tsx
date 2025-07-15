"use client";

import {
  ReminderType,
  reminderColumns,
  reminderDefaultValue,
} from "@/components/reminder/ReminderColumn";

import { createClient } from "@/lib/supabase/client";
import { useContext, useEffect, useState } from "react";
import { DataTable } from "@/components/common/DataTable";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderSearchForm from "./ReminderSearchForm";
import ReminderFormDialog from "./ReminderFormDialog";

export default function ReminderTable() {
  const [reminders, setReminders] = useState<ReminderType[]>();
  const [total, setTotal] = useState<number>();

  const {
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    columnFilters,
    setColumnFilters,
    setSelectedRow,
    setSubmitError,
  } = useContext(ReminderContext) as ReminderContextType;

  const supabase = createClient();

  useEffect(() => {
    async function getProduct() {
      const { data, error, count } = await supabase
        .from("payment_reminder")
        .select("*", { count: "exact" })
        .limit(100);

      if (error) console.log(error);

      if (data) {
        setReminders(data);
      }
      if (count) setTotal(count);
    }

    setSubmitError(undefined);
    getProduct();
  }, [
    supabase,
    openCreateDialog,
    openUpdateDialog,
    setSelectedRow,
    setReminders,
    setSubmitError,
  ]);
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-between items-center px-4">
        <div className="flex-1"></div>
        <h2 className="text-xl">รายการเตือนชำระเงิน</h2>
        <div className="flex-1 flex justify-end">
          <ReminderFormDialog
            open={openCreateDialog}
            setOpen={setOpenCreateDialog}
            dialogTrigger="เพิ่มรายการเตือนโอน"
            defaultValues={reminderDefaultValue}
          />
        </div>
      </div>

      <div>
        <ReminderSearchForm
          defaultValues={{ supplier_name: "", note_id: "" }}
        />
      </div>

      <div className="h-full">
        {!!reminders && (
          <DataTable
            columns={reminderColumns}
            data={reminders}
            total={total}
            setSelectedRow={setSelectedRow}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            initialState={{
              columnFilters: columnFilters,
            }}
          ></DataTable>
        )}
      </div>
    </div>
  );
}
