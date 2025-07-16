"use client";

import { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";
import { fieldLabel } from "./ReminderForm";
import { Row } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ReminderType = {
  id: number;
  created_at: string;
  supplier_name: string;
  note_id: string;
  bill_count: number;
  start_date: string;
  end_date: string;
  total_amount: number;
  discount: number;
  user_id: string;
  due_date: string;
  kbiz_datetime: string;
  payment_date: string;
  remark: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  last_modified: string;
};

export type ReminderDefaultValueType = {
  supplier_name: string;
  note_id: string;
  bill_count: number;
  start_date: Date;
  end_date: Date;
  total_amount: number;
  discount: number;
  due_date: Date;
  kbiz_datetime: Date | null;
  payment_date: Date | null;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  remark: string;
};

export const reminderDefaultValue: ReminderDefaultValueType = {
  supplier_name: "",
  note_id: "",
  bill_count: 1,
  start_date: new Date(),
  end_date: new Date(),
  total_amount: 0,
  discount: 0,
  due_date: new Date(),
  kbiz_datetime: null,
  payment_date: null,
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  remark: "",
};

export const reminderColumns: ColumnDef<ReminderType>[] = [
  simpleText("supplier_name"),
  simpleText("note_id"),
  dateThai("start_date"),
  dateThai("end_date"),
  numberFloat("total_amount"),
  dateThai("due_date"),
  dateThai("kbiz_datetime", true),
  dateThai("payment_date"),
  {
    id: "สถานะ",
    accessorKey: "payment_date",
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title="สถานะ" />
    ),
    cell: (row) => {
      return (
        <div className="text-right">{row.getValue() ? "จ่ายแล้ว" : "ค้าง"}</div>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      return (
        (row.getValue(columnId) as string) ? "จ่ายแล้ว" : "ค้าง"
      ).includes(filterValue);
    },
  },
];

function simpleText(key: keyof ReminderType) {
  return {
    id: fieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={fieldLabel[key]} />
    ),
  };
}

function dateThai(key: keyof ReminderType, withTime: boolean = false) {
  return {
    id: fieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={fieldLabel[key]} />
    ),
    cell: (row: Row<ReminderType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(fieldLabel[key]) &&
            new Date(row.getValue(fieldLabel[key]) as string).toLocaleString(
              "th-TH",
              {
                day: "2-digit",
                month: "narrow",
                year: "2-digit",
                ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
              }
            )}
        </div>
      );
    },
    filterFn: (row: Row<ReminderType>, columnId: string, filterValue: string) =>
      dateFilterFn(row, columnId, filterValue),
  };
}

function numberFloat(key: keyof ReminderType) {
  return {
    id: fieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={fieldLabel[key]} />
    ),
    cell: (row: Row<ReminderType>) => {
      return (
        <div className="text-right">
          {(row.getValue(fieldLabel[key]) as number).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
    filterFn: (
      row: Row<ReminderType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(fieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function dateFilterFn(
  row: Row<ReminderType>,
  columnId: string,
  filterValue: string
) {
  return new Date(row.getValue(columnId) as string)
    .toLocaleString("th-TH", {
      day: "2-digit",
      month: "narrow",
      year: "2-digit",
    })
    .includes(filterValue);
}
