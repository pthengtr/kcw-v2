"use client";

import { reminderColumns } from "@/components/reminder/ReminderColumn";

import { useContext, useEffect } from "react";
import { DataTable } from "@/components/common/DataTable";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderSearchForm from "./ReminderSearchForm";
import ReminderFormDialog from "./ReminderFormDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Plus, RefreshCcw } from "lucide-react";
import { clearMyCookie } from "@/app/(root)/action";
import ResetTableCookiesDropdown from "../common/ResetTableCookiesDropdown";
import { Button } from "../ui/button";

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
    status,
    setStatus,
    getReminder,
    setSelectedSupplier,
  } = useContext(ReminderContext) as ReminderContextType;

  useEffect(() => {
    setSelectedSupplier(undefined);
    setSubmitError(undefined);
    getReminder();
  }, [
    getReminder,
    openCreateDialog,
    openUpdateDialog,
    setSelectedSupplier,
    setSubmitError,
    status,
  ]);

  function handleResetCookies() {
    clearMyCookie("reminderColumnVisibility");
    clearMyCookie("reminderPaginationPageSize");
    getReminder();
  }

  return (
    <div className="flex flex-col gap-2 p-2 h-full">
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
            dialogTrigger={
              <Button>
                <Plus />
              </Button>
            }
            dialogHeader="เพิ่มรายการเตือนโอน"
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  getReminder();
                }}
              >
                <RefreshCcw strokeWidth={1} /> รีเฟรช
              </Button>
              <ResetTableCookiesDropdown
                handleResetCookies={handleResetCookies}
              />
            </div>
          </DataTable>
        )}
      </div>
    </div>
  );
}
