"use client";

import {
  reminderColumns,
  reminderDefaultValue,
} from "@/components/reminder/ReminderColumn";

import { useContext, useEffect } from "react";
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
  "จำนวนเงิน (หักส่วนลดแล้ว)": true,
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
  const {
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setSubmitError,
    reminders,
    total,
    handleSelectedRow,
    isAdmin,
    status,
    setStatus,
    getReminder,
  } = useContext(ReminderContext) as ReminderContextType;

  useEffect(() => {
    setSubmitError(undefined);
    getReminder();
  }, [getReminder, openCreateDialog, openUpdateDialog, setSubmitError, status]);

  function handleResetView() {
    clearMyCookie("reminderColumnVisibility");
    clearMyCookie("reminderPaginationPageSize");
    getReminder();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { payment_date, ...nonAdminDefaultValue } = reminderDefaultValue;
  const defaultValues = isAdmin ? reminderDefaultValue : nonAdminDefaultValue;

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex justify-center items-end p-4 gap-4">
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
            dialogHeader="เพิ่มรายการเตือนโอน"
            defaultValues={defaultValues}
          />
        </div>
      </div>

      <div className="h-full">
        {!!reminders && (
          <DataTable
            tableName="reminder"
            columns={reminderColumns}
            data={reminders}
            total={total}
            setSelectedRow={handleSelectedRow}
            initialState={{
              columnVisibility: columnVisibility,
              pagination: { pageIndex: 0, pageSize: paginationPageSize },
            }}
            totalAmountKey={["จำนวนเงิน (หักส่วนลดแล้ว)", "ส่วนลด"]}
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
