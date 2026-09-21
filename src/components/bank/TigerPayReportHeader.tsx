"use client";

import type { ReactNode } from "react";
import { CalendarIcon, ChevronDown, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { bangkokTodayIso } from "@/lib/bi/sales-periods";
import {
  formatReportDate,
  isoDateToLocalDate,
  localDateToIso,
} from "@/lib/bank/tiger-pay-report";
import { formatBangkokDateTime } from "@/lib/bank/tiger-pay-format";
import type { TigerPayDailyClose } from "@/lib/bank/tiger-pay-daily";

export default function TigerPayReportHeader({
  date,
  onDateChange,
  dailyClose,
  hopperRefreshing,
  onCloseDay,
  onViewZReport,
  extraActions,
  showDateControls = true,
}: {
  date: string;
  onDateChange: (date: string) => void;
  dailyClose: TigerPayDailyClose | null;
  hopperRefreshing?: boolean;
  onCloseDay?: (date: string) => Promise<void> | void;
  onViewZReport?: () => void;
  extraActions?: ReactNode;
  showDateControls?: boolean;
}) {
  const selected = isoDateToLocalDate(date);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
          aria-hidden
        >
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            รายงาน Tiger Pay
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            สรุปการรับ-จ่ายเงินสด และ QR / PromptPay ผ่านเครื่อง Tiger
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {showDateControls ? (
          <>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">
                วันที่ (กรุงเทพฯ)
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-[150px] justify-between bg-white px-3 font-normal"
                  >
                    <span>{formatReportDate(date)}</span>
                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="end"
                >
                  <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(next) => {
                      if (!next) return;
                      onDateChange(localDateToIso(next));
                    }}
                    defaultMonth={selected}
                  />
                </PopoverContent>
              </Popover>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 bg-white"
              onClick={() => onDateChange(bangkokTodayIso())}
            >
              วันนี้
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 bg-white"
                  disabled={hopperRefreshing}
                >
                  ปิดวัน (Z-report)
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {dailyClose ? (
                  <>
                    <DropdownMenuItem disabled>
                      ปิดแล้ว {formatBangkokDateTime(dailyClose.closed_at)}
                    </DropdownMenuItem>
                    {onViewZReport ? (
                      <DropdownMenuItem onClick={onViewZReport}>
                        ดู Z-report
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : (
                  <DropdownMenuItem
                    disabled={!onCloseDay || hopperRefreshing}
                    onClick={() => void onCloseDay?.(date)}
                  >
                    ปิดวันวันนี้
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
        {extraActions}
      </div>
    </div>
  );
}
