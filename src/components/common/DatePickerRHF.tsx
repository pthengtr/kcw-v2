// components/forms/DatePickerRHF.tsx
"use client";

import * as React from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { DatePickerInput } from "@/components/common/DatePickerInput";

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toISODateTimeLocal(d: Date): string {
  const base = toISODateLocal(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${base}T${hh}:${mm}`;
}
function parseStringToDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = v.includes("T") ? new Date(v) : new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  timePicker?: boolean; // if true, form stores 'yyyy-MM-ddTHH:mm'
  optional?: boolean; // show clear button
};

export function DatePickerRHF<T extends FieldValues>({
  control,
  name,
  timePicker = false,
  optional = false,
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const dateVal = parseStringToDate(field.value as string | undefined);

        // Build the field expected by your DatePickerInput (works with or without RHF)
        const proxyField = {
          name: field.name,
          value: dateVal, // Date | undefined
          onChange: (d?: Date | "") => {
            if (d instanceof Date && !Number.isNaN(d.getTime())) {
              field.onChange(
                timePicker ? toISODateTimeLocal(d) : toISODateLocal(d)
              );
            } else {
              // cleared → empty string (will trigger required error if your schema enforces it)
              field.onChange("");
            }
          },
          onBlur: field.onBlur,
          ref: field.ref,
        };

        return (
          <DatePickerInput
            field={proxyField}
            timePicker={timePicker}
            optional={optional}
          />
        );
      }}
    />
  );
}
