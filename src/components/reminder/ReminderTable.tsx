"use client";

import {
  reminderColumns,
  reminderDefaultValue,
} from "@/components/reminder/ReminderColumn";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useContext, useEffect, useState } from "react";
import { DataTable } from "@/components/common/DataTable";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderSearchForm from "./ReminderSearchForm";
import ReminderFormDialog from "./ReminderFormDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EllipsisVertical, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { clearMyCookie } from "@/app/(root)/action";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const defaultColumnVisibility = {
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

type ReminderTableProps = {
  columnVisibility: typeof defaultColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ReminderTable({
  columnVisibility,
  paginationPageSize,
}: ReminderTableProps) {
  const [status, setStatus] = useState("all");

  const {
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    columnFilters,
    setColumnFilters,
    setSubmitError,
    reminders,
    setReminders,
    total,
    setTotal,
    handleSelectedRow,
  } = useContext(ReminderContext) as ReminderContextType;

  const supabase = createClient();

  const getReminder = useCallback(
    async function () {
      let query = supabase
        .from("payment_reminder")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .limit(500);

      if (status === "paid") query = query.not("payment_date", "is", "null");
      else if (status === "unpaid") query = query.is("payment_date", null);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setReminders(data);
      }
      if (count) setTotal(count);
    },
    [setReminders, setTotal, status, supabase]
  );

  useEffect(() => {
    setSubmitError(undefined);
    getReminder();
  }, [
    supabase,
    openCreateDialog,
    openUpdateDialog,
    setReminders,
    setSubmitError,
    setTotal,
    status,
    getReminder,
  ]);

  function handleResetView() {
    clearMyCookie("columnVisibility");
    clearMyCookie("paginationPageSize");
    getReminder();
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-center items-center p-4 gap-4">
        <div>
          <ReminderSearchForm
            defaultValues={{
              search_supplier_name: "",
              note_id: "",
              due_month: "all",
              payment_month: "all",
            }}
          />
        </div>
        <div className="flex justify-end">
          <ReminderFormDialog
            open={openCreateDialog}
            setOpen={setOpenCreateDialog}
            dialogTrigger={<Plus />}
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
            setSelectedRow={handleSelectedRow}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            initialState={{
              columnFilters: columnFilters,
              columnVisibility: columnVisibility,
              pagination: { pageIndex: 0, pageSize: paginationPageSize },
            }}
            totalAmountKey={["จำนวนเงิน", "ส่วนลด"]}
          >
            <div className="flex gap-4 mr-auto px-8">
              <h2 className="text-2xl font-bold flex-1">รายการเตือนชำระเงิน</h2>
              <Tabs value={status} onValueChange={setStatus} className="">
                <TabsList>
                  <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="unpaid">ค้างชำระ</TabsTrigger>
                  <TabsTrigger value="paid">จ่ายแล้ว</TabsTrigger>
                </TabsList>
              </Tabs>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-8 lg:flex"
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleResetView}>
                    ลบความจำรูปแบบตาราง ใช้ค่าเริ่มต้นในครั้งต่อไป
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DataTable>
        )}
      </div>
    </div>
  );
}
