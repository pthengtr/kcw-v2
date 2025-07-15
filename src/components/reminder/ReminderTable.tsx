"use client";

import {
  ReminderType,
  reminderColumns,
  reminderDefaultValue,
} from "@/components/reminder/ReminderColumn";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { createClient } from "@/lib/supabase/client";
import { useContext, useEffect, useState } from "react";
import { DataTable } from "@/components/common/DataTable";
import ReminderForm from "./ReminderForm";
import { Button } from "../ui/button";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";

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

    getProduct();
  }, [
    supabase,
    openCreateDialog,
    openUpdateDialog,
    setSelectedRow,
    setReminders,
  ]);
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-between items-center px-4">
        <div className="flex-1"></div>
        <h2 className="text-xl">รายการเตือนชำระเงิน</h2>
        <div className="flex-1 flex justify-end">
          {/* <Link href="/createnewreminder" legacyBehavior passHref>
            <Button>เพิ่มรายการเตือนโอน</Button>
          </Link> */}
          <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
            <DialogTrigger asChild>
              <Button id="create-reminder">เพิ่มรายการเตือนโอน</Button>
            </DialogTrigger>
            <DialogContent className="max-w-fit  h-5/6">
              <DialogHeader className="grid place-content-center py-4">
                <DialogTitle>เพิ่มรายการเตือนโอน</DialogTitle>
              </DialogHeader>
              <div className="w-[60vw] h-full overflow-y-auto">
                <ReminderForm defaultValues={reminderDefaultValue} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
