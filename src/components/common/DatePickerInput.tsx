"use client";

import * as React from "react";
import { CalendarIcon, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FieldValues } from "react-hook-form";
import { FormControl } from "../ui/form";
import { cn } from "@/lib/utils";
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

type DatePickerInputProps = {
  field: FieldValues;
  timePicker?: boolean;
  optional?: boolean;
};

export function DatePickerInput({
  field,
  timePicker = false,
  optional = false,
}: DatePickerInputProps) {
  const [hours, setHours] = React.useState(
    field.value ? field.value.getHours().toString() : "0"
  );
  const [minutes, setMinutes] = React.useState(
    field.value ? field.value.getMinutes().toString() : "0"
  );

  function handleClearSelect() {
    field.onChange("");
    setHours("0");
    setMinutes("0");
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // Define start and end month range
  const startMonth = new Date(currentYear - 5, 0); // Jan (year - 5)
  const endMonth = new Date(currentYear + 5, 11); // Dec (year + 5)

  return (
    <div className="flex gap-4">
      <div className="">
        <Popover modal>
          <PopoverTrigger asChild>
            <FormControl>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] pl-3 text-left font-normal",
                  !field.value && "text-muted-foreground"
                )}
              >
                {field.value ? (
                  field.value.toLocaleDateString("th-TH", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                ) : (
                  <span>เลือกวันที่</span>
                )}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={field.value}
              onSelect={(selected) => {
                selected?.setHours(parseInt(hours));
                selected?.setMinutes(parseInt(minutes));
                field.onChange(selected);
              }}
              startMonth={startMonth}
              endMonth={endMonth}
              captionLayout="dropdown"
              formatters={{
                formatCaption: (date) =>
                  date.toLocaleDateString("th-TH", {
                    month: "long",
                    year: "numeric",
                  }),
                formatMonthDropdown: (date) =>
                  date.toLocaleDateString("th-TH", {
                    month: "long",
                  }),
                formatYearDropdown: (date) =>
                  date.toLocaleDateString("th-TH", {
                    year: "numeric",
                  }),

                formatWeekdayName: (date) =>
                  date.toLocaleDateString("th-TH", { weekday: "short" }),
              }}
              classNames={{
                day_selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {timePicker && (
        <div className="flex gap-2 items-center">
          <span>เวลา</span>
          <Select
            disabled={!field.value}
            value={hours}
            onValueChange={(hours) => {
              setHours(hours);
              field.value.setHours(hours);
              field.onChange(field.value);
            }}
          >
            <SelectTrigger className="[&_svg]:hidden">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {[...Array(24).keys()].map((index) => (
                <SelectItem key={`H-${index}`} value={index.toString()}>
                  {index.toString().padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>:</span>
          <Select
            disabled={!field.value}
            value={minutes}
            onValueChange={(minutes) => {
              setMinutes(minutes);
              field.value.setMinutes(minutes);
              field.onChange(field.value);
            }}
          >
            <SelectTrigger className="[&_svg]:hidden">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {[...Array(60).keys()].map((index) => (
                <SelectItem key={`H-${index}`} value={index.toString()}>
                  {index.toString().padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {optional && (
        <Button type="reset" onClick={handleClearSelect}>
          <Trash />
        </Button>
      )}
    </div>
  );
}
