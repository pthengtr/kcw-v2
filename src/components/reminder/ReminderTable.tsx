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

type ReminderTableProps = {
  setSelectedRow: (selectedRow: ReminderType) => void;
};

export default function ReminderTable({ setSelectedRow }: ReminderTableProps) {
  const [reminders, setReminders] = useState<ReminderType[]>();
  const [total, setTotal] = useState<number>();
  const supabase = createClient();

  useEffect(() => {
    async function getProduct() {
      const { data, error, count } = await supabase
        .from("payment_reminder")
        .select("*", { count: "exact" })
        .limit(100);

      if (error) console.log(error);

      if (data) setReminders(data);
      if (count) setTotal(count);
    }

    getProduct();
  }, [supabase]);
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-between items-center px-4">
        <div className="flex-1"></div>
        <h2 className="text-xl">รายการเตือนชำระเงิน</h2>
        <div className="flex-1 flex justify-end">
          {/* <Link href="/createnewreminder" legacyBehavior passHref>
            <Button>เพิ่มรายการเตือนโอน</Button>
          </Link> */}
          <Dialog>
            <DialogTrigger>เพิ่มรายการเตือนโอน</DialogTrigger>
            <DialogContent className="max-w-fit overflow-y-auto h-5/6">
              <DialogHeader className="grid place-content-center">
                <DialogTitle>เพิ่มรายการเตือนโอน</DialogTitle>
              </DialogHeader>
              <div className="w-[60vw]">
                <CreateReminderForm />
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
          ></DataTable>
        )}
      </div>
    </div>
  );
}
