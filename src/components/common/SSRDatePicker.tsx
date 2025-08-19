// components/SSRDatePicker.tsx
"use client";

import * as React from "react";
import { CalendarIcon, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"; // shadcn (react-day-picker)
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
  /** Input/output as 'yyyy-MM-dd' (or 'yyyy-MM-ddTHH:mm' when withTime) */
  value?: string;
  onChange: (val?: string) => void; // undefined => clear
  withTime?: boolean;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
  name?: string;
};

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toISODateTimeLocal(d: Date): string {
  const date = toISODateLocal(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date}T${hh}:${mm}`;
}

function parseFlexible(val?: string): Date | undefined {
  if (!val) return undefined;
  // Supports 'yyyy-MM-dd' or 'yyyy-MM-ddTHH:mm'
  const d = val.includes("T") ? new Date(val) : new Date(`${val}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

export function SSRDatePicker({
  value,
  onChange,
  withTime = false,
  clearable = true,
  placeholder = "เลือกวันที่",
  className,
  name = "date",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseFlexible(value);

  const [date, setDate] = React.useState<Date | undefined>(parsed);
  const [hours, setHours] = React.useState<string>(
    parsed ? String(parsed.getHours()).padStart(1, "0") : "0"
  );
  const [minutes, setMinutes] = React.useState<string>(
    parsed ? String(parsed.getMinutes()).padStart(1, "0") : "0"
  );

  // keep local state in sync when parent changes (URL changes)
  React.useEffect(() => {
    const d = parseFlexible(value);
    setDate(d);
    if (d) {
      setHours(String(d.getHours()));
      setMinutes(String(d.getMinutes()));
    } else {
      setHours("0");
      setMinutes("0");
    }
  }, [value]);

  function commit(next?: Date) {
    if (!next) {
      onChange(undefined);
      return;
    }
    if (withTime) {
      onChange(toISODateTimeLocal(next));
    } else {
      onChange(toISODateLocal(next));
    }
  }

  function handleSelectDay(selected?: Date) {
    if (!selected) {
      setDate(undefined);
      commit(undefined);
      return;
    }
    // apply current time selections if needed
    if (withTime) {
      selected.setHours(parseInt(hours, 10) || 0);
      selected.setMinutes(parseInt(minutes, 10) || 0);
    } else {
      selected.setHours(0, 0, 0, 0);
    }
    setDate(selected);
    commit(selected);
    setOpen(false);
  }

  function handleClear() {
    setDate(undefined);
    setHours("0");
    setMinutes("0");
    onChange(undefined);
    setOpen(false);
  }

  const displayText = date
    ? date.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }) +
      (withTime
        ? ` ${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
          ).padStart(2, "0")}`
        : "")
    : undefined;

  return (
    <div className="flex gap-2 items-center">
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-[240px] pl-3 justify-between text-left font-normal",
              className
            )}
            aria-label={name}
          >
            <span className={cn(!date && "text-muted-foreground")}>
              {displayText ?? placeholder}
            </span>
            <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-sm font-medium">เลือกวันที่</div>
              {clearable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleClear}
                >
                  <Trash className="h-4 w-4" />
                  <span className="sr-only">ล้างค่า</span>
                </Button>
              )}
            </div>

            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelectDay}
              captionLayout="dropdown"
              formatters={{
                formatCaption: (d) =>
                  d.toLocaleDateString("th-TH", {
                    month: "long",
                    year: "numeric",
                  }),
                formatMonthDropdown: (d) =>
                  d.toLocaleDateString("th-TH", { month: "long" }),
                formatYearDropdown: (d) =>
                  d.toLocaleDateString("th-TH", { year: "numeric" }),
                formatWeekdayName: (d) =>
                  d.toLocaleDateString("th-TH", { weekday: "short" }),
              }}
              classNames={{
                day_selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              }}
              initialFocus
            />

            {withTime && (
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-sm">เวลา</span>
                <Select
                  disabled={!date}
                  value={hours}
                  onValueChange={(h) => {
                    setHours(h);
                    if (date) {
                      const next = new Date(date);
                      next.setHours(parseInt(h, 10) || 0);
                      setDate(next);
                      commit(next);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-[80px] [&_svg]:hidden">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={`H-${i}`} value={String(i)}>
                        {String(i).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>:</span>
                <Select
                  disabled={!date}
                  value={minutes}
                  onValueChange={(m) => {
                    setMinutes(m);
                    if (date) {
                      const next = new Date(date);
                      next.setMinutes(parseInt(m, 10) || 0);
                      setDate(next);
                      commit(next);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-[80px] [&_svg]:hidden">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 60 }, (_, i) => (
                      <SelectItem key={`M-${i}`} value={String(i)}>
                        {String(i).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
