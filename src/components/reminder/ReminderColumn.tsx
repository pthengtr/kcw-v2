"use client";

import { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";
import { fieldLabel } from "./CreateReminderForm";
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
  last_modified: string;
};
export const reminderColumns: ColumnDef<ReminderType>[] = [
  simpleText("supplier_name"),
  simpleText("note_id"),
  dateThai("start_date"),
  dateThai("end_date"),
  numberFloat("total_amount"),
  dateThai("due_date"),
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

function dateThai(key: keyof ReminderType) {
  return {
    id: fieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ReminderType, unknown>) => (
      <DataTableColumnHeader column={column} title={fieldLabel[key]} />
    ),
    cell: (row: Row<ReminderType>) => {
      return (
        <div className="text-right">
          {new Date(row.getValue(fieldLabel[key]) as string).toLocaleString(
            "th-TH",
            {
              day: "2-digit",
              month: "narrow",
              year: "2-digit",
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
      console.log(
        (row.getValue(fieldLabel[key]) as number).toString(),
        filterValue
      );
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
  console.log(
    new Date(row.getValue(columnId) as string).toLocaleString("th-TH", {
      day: "2-digit",
      month: "narrow",
      year: "2-digit",
    }),
    filterValue
  );
  return new Date(row.getValue(columnId) as string)
    .toLocaleString("th-TH", {
      day: "2-digit",
      month: "narrow",
      year: "2-digit",
    })
    .includes(filterValue);
}
