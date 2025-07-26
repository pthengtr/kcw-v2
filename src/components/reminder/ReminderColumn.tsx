"use client";

import { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";
import { reminderFieldLabel } from "./ReminderForm";
import { Row } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export type BankInfoType = {
  id: number;
  supplier_name: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
};

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
  payment_date?: Date | null;
  bill_pictures: File[];
  payment_pictures: File[];
  bank_info: BankInfoType | null;
  remark: string;
  agree: boolean;
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
  bill_pictures: [],
  payment_pictures: [],
  bank_info: null,
  remark: "",
  agree: false,
};

export const reminderColumns: ColumnDef<ReminderType>[] = [
  numberInt("id"),
  dateThai("created_at", true),
  dateThai("last_modified", true),
  simpleText("supplier_name"),
  simpleText("note_id"),
  numberInt("bill_count"),
  dateThai("start_date"),
  dateThai("end_date"),
  numberFloat("total_amount"),
  numberFloat("discount"),
  simpleText("user_id"),
  dateThai("due_date"),
  dateThai("kbiz_datetime", true),
  dateThai("payment_date"),
  simpleText("remark"),
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
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
  };
}

function dateThai(key: keyof ReminderType, withTime: boolean = false) {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: Row<ReminderType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(reminderFieldLabel[key]) &&
            new Date(
              row.getValue(reminderFieldLabel[key]) as string
            ).toLocaleString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
            })}
        </div>
      );
    },
    filterFn: (row: Row<ReminderType>, columnId: string, filterValue: string) =>
      dateFilterFn(row, columnId, filterValue),
  };
}

function numberFloat(key: keyof ReminderType) {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: Row<ReminderType>) => {
      return (
        <div className="text-right">
          {(row.getValue(reminderFieldLabel[key]) as number).toLocaleString(
            "th-TH",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}
        </div>
      );
    },
    filterFn: (
      row: Row<ReminderType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(reminderFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function numberInt(key: keyof ReminderType) {
  return {
    id: reminderFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={reminderFieldLabel[key]} />
    ),
    cell: (row: Row<ReminderType>) => {
      return (
        <div className="text-right">
          {(row.getValue(reminderFieldLabel[key]) as number).toLocaleString(
            "th-TH"
          )}
        </div>
      );
    },
    filterFn: (
      row: Row<ReminderType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(reminderFieldLabel[key]) as number)
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
      month: "2-digit",
      year: "2-digit",
    })
    .includes(filterValue);
}
