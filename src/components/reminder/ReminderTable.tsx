"use client";

import {
  ReminderType,
  reminderColumns,
} from "@/components/reminder/ReminderColumn";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/common/DataTable";
import CreateReminderForm from "./CreateReminderForm";
import { Button } from "../ui/button";
import { ColumnFiltersState } from "@tanstack/react-table";

type ReminderTableProps = {
  setSelectedRow: (selectedRow: ReminderType) => void;
};

export default function ReminderTable({ setSelectedRow }: ReminderTableProps) {
  const [reminders, setReminders] = useState<ReminderType[]>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [total, setTotal] = useState<number>();
  const [open, setOpen] = useState(false);

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
  }, [supabase, open, setSelectedRow, setReminders]);
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-between items-center px-4">
        <div className="flex-1"></div>
        <h2 className="text-xl">รายการเตือนชำระเงิน</h2>
        <div className="flex-1 flex justify-end">
          {/* <Link href="/createnewreminder" legacyBehavior passHref>
            <Button>เพิ่มรายการเตือนโอน</Button>
          </Link> */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>เพิ่มรายการเตือนโอน</Button>
            </DialogTrigger>
            <DialogContent className="max-w-fit  h-5/6">
              <DialogHeader className="grid place-content-center py-4">
                <DialogTitle>เพิ่มรายการเตือนโอน</DialogTitle>
              </DialogHeader>
              <div className="w-[60vw] h-full overflow-y-auto">
                <CreateReminderForm
                  setOpen={setOpen}
                  setColumnFilters={setColumnFilters}
                  setSelectedRow={setSelectedRow}
                />
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
