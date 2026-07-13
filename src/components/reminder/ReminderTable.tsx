"use client";

import { reminderColumns } from "@/components/reminder/ReminderColumn";

import { useContext, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/common/DataTable";

import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderSearchForm from "./ReminderSearchForm";
import ReminderFormDialog from "./ReminderFormDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ChevronLeft, ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { clearMyCookie } from "@/app/(root)/action";
import ResetTableCookiesDropdown from "../common/ResetTableCookiesDropdown";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaymentReminderRow } from "@/lib/types/models";

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

type ReminderRow = PaymentReminderRow & {
  party?: {
    party_uuid: string;
    party_name: string;
    party_code: string | null;
  } | null;
};

type ReminderTableProps = {
  columnVisibility: typeof defaultColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

const fmtAmount = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

const fmtDate = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "—";

function MobileReminderCard({
  row,
  onClick,
}: {
  row: ReminderRow;
  onClick: () => void;
}) {
  const isPaid = !!row.payment_date;
  const partyName = row.party?.party_name ?? row.party_uuid ?? "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border bg-white p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant={isPaid ? "default" : "secondary"} className="shrink-0">
          {isPaid ? "จ่ายแล้ว" : "ค้างชำระ"}
        </Badge>
        <div className="text-right text-xs text-muted-foreground leading-snug">
          กำหนด {fmtDate(row.due_date)}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <div>
          <div className="text-xs text-muted-foreground">คู่ค้า</div>
          <div className="font-medium break-words">{partyName}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">เลขที่เอกสาร</div>
            <div className="text-sm break-all">{row.note_id || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">จำนวนเงิน</div>
            <div className="text-sm font-medium">{fmtAmount(row.total_amount)}</div>
          </div>
        </div>

        {isPaid && (
          <div>
            <div className="text-xs text-muted-foreground">วันโอนจริง</div>
            <div className="text-sm">{fmtDate(row.payment_date)}</div>
          </div>
        )}
      </div>
    </button>
  );
}

function MobilePaginationBar({
  total,
  pageIndex,
  pageSize,
  pageCount,
  onPageIndexChange,
  onPageSizeChange,
}: {
  total: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPageIndexChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
}) {
  const pageSizes = [10, 20, 50, 100, 200, 500];

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground">
      <div>
        {total > 0
          ? `แสดงหน้า ${pageIndex + 1} จาก ${pageCount} (ทั้งหมด ${total} รายการ)`
          : "ไม่มีรายการ"}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap">รายการ/หน้า</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            onPageSizeChange(Number(v));
            onPageIndexChange(0);
          }}
        >
          <SelectTrigger className="h-8 w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex <= 0}
          onClick={() => onPageIndexChange(Math.max(0, pageIndex - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pageIndex >= pageCount - 1}
          onClick={() =>
            onPageIndexChange(Math.min(pageCount - 1, pageIndex + 1))
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

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

  const [mobilePageIndex, setMobilePageIndex] = useState(0);
  const [mobilePageSize, setMobilePageSize] = useState(
    paginationPageSize ?? 10,
  );

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

  useEffect(() => {
    if (paginationPageSize) setMobilePageSize(paginationPageSize);
  }, [paginationPageSize]);

  useEffect(() => {
    setMobilePageIndex(0);
  }, [reminders, status]);

  const reminderRows = (reminders ?? []) as ReminderRow[];
  const mobilePageCount = Math.max(
    1,
    Math.ceil(reminderRows.length / mobilePageSize),
  );
  const mobilePageRows = useMemo(() => {
    const start = mobilePageIndex * mobilePageSize;
    return reminderRows.slice(start, start + mobilePageSize);
  }, [reminderRows, mobilePageIndex, mobilePageSize]);

  function handleResetCookies() {
    clearMyCookie("reminderColumnVisibility");
    clearMyCookie("reminderPaginationPageSize");
    getReminder();
  }

  function renderStatusToolbar() {
    return (
      <>
        <Tabs value={status} onValueChange={setStatus}>
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
        <ResetTableCookiesDropdown handleResetCookies={handleResetCookies} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 h-full min-h-0">
      <div className="flex flex-col sm:flex-row sm:justify-center sm:items-end p-2 sm:p-4 gap-3 sm:gap-4">
        <div className="w-full sm:w-auto min-w-0 flex-1">
          <ReminderSearchForm
            defaultValues={{
              search_supplier_name: "",
              note_id: "",
              due_month: "all",
              payment_month: "all",
            }}
          />
        </div>
        <div className="flex justify-end shrink-0">
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

      <div className="h-full min-h-0">
        {!!reminders && (
          <>
            {/* Mobile card list */}
            <div className="md:hidden flex flex-col gap-3">
              <div className="rounded-md border bg-slate-50 p-3 flex flex-col gap-3">
                <h2 className="text-xl font-bold">รายการเตือนชำระเงิน</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusToolbar()}
                </div>
              </div>

              <MobilePaginationBar
                total={reminderRows.length}
                pageIndex={Math.min(mobilePageIndex, mobilePageCount - 1)}
                pageSize={mobilePageSize}
                pageCount={mobilePageCount}
                onPageIndexChange={setMobilePageIndex}
                onPageSizeChange={setMobilePageSize}
              />

              <div className="flex flex-col gap-2">
                {mobilePageRows.map((row) => (
                  <MobileReminderCard
                    key={row.reminder_uuid}
                    row={row}
                    onClick={() => handleSelectedRow(row)}
                  />
                ))}
                {mobilePageRows.length === 0 && (
                  <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                    ไม่พบรายการ
                  </div>
                )}
              </div>
            </div>

            {/* Desktop / tablet table */}
            <div className="hidden md:block h-full">
              <DataTable
                tableName="reminder"
                columns={reminderColumns}
                data={reminders}
                total={total}
                setSelectedRow={handleSelectedRow}
                initialState={{
                  columnVisibility: columnVisibility,
                  pagination: {
                    pageIndex: 0,
                    pageSize: paginationPageSize,
                  },
                }}
                totalAmountKey={["จำนวนเงิน (หักส่วนลดแล้ว)", "ส่วนลด"]}
              >
                <div className="flex gap-4 mr-auto px-8">
                  <h2 className="text-2xl font-bold flex-1">
                    รายการเตือนชำระเงิน
                  </h2>
                  {renderStatusToolbar()}
                </div>
              </DataTable>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
