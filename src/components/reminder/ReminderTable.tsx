"use client";

import {
  reminderColumns,
  reminderDefaultValue,
} from "@/components/reminder/ReminderColumn";

import { createClient } from "@/lib/supabase/client";
import { useContext, useEffect } from "react";
import { DataTable } from "@/components/common/DataTable";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderSearchForm from "./ReminderSearchForm";
import ReminderFormDialog from "./ReminderFormDialog";

const defaultColumnVisibility = {
  รายการเลขที่: false,
  สร้าง: false,
  บริษัท: true,
  เลขที่ใบวางบิล: true,
  จำนวนบิล: false,
  บิลวันที่: true,
  ถีง: true,
  จำนวนเงิน: true,
  ส่วนลด: false,
  พนักงาน: false,
  กำหนดชำระ: true,
  "แจ้งเตือน KBIZ": false,
  วันที่ชำระ: true,
  สถานะ: true,
  หมายเหตุ: false,
  แก้ไขล่าสุด: false,
  // ชื่อธนาคาร: true,
  // ชื่อบัญชี: true,
  // เลขบัญชี: true,
  // "เพิ่มรูปบิล/ใบวางบิล": true,
  // เพิ่มรูปหลักฐานการขำระเงิน: true,
};

export default function ReminderTable() {
  const {
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    columnFilters,
    setColumnFilters,
    setSelectedRow,
    setSubmitError,
    reminders,
    setReminders,
    total,
    setTotal,
  } = useContext(ReminderContext) as ReminderContextType;

  const supabase = createClient();

  useEffect(() => {
    async function getProduct() {
      const { data, error, count } = await supabase
        .from("payment_reminder")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .limit(100);

      if (error) {
        console.log(error);
        return;
      }

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
    setTotal,
  ]);
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-between items-center p-4">
        <div className="flex-1"></div>
        <div>
          <ReminderSearchForm
            defaultValues={{
              supplier_name: "",
              note_id: "",
              due_month: "all",
              payment_month: "all",
            }}
          />
        </div>
        <div className="flex-1 flex justify-end">
          <ReminderFormDialog
            open={openCreateDialog}
            setOpen={setOpenCreateDialog}
            dialogTrigger="เพิ่มรายการเตือนโอน"
            defaultValues={reminderDefaultValue}
          />
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
              columnVisibility: defaultColumnVisibility,
            }}
            totalAmountKey="จำนวนเงิน"
          >
            <h2 className="text-2xl font-bold flex-1 px-8">
              รายการเตือนชำระเงิน
            </h2>
          </DataTable>
        )}
      </div>
    </div>
  );
}
