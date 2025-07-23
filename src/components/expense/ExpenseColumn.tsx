"use client";

import { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";
import { expenseFieldLabel } from "./ExpenseForm";
import { Row } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export type ExpenseType = {
  id: number;
  created_at: string;
  company_name: string;
  invoice_number: string;
  receipt_number: number;
  expense_group: string;
  detail: string;
  total_amount: number;
  payment_date: string;
  payment_mode: string;
  branch_name: string;
  remark: string;
  last_modified: string;
};

export const expenseColumn: ColumnDef<ExpenseType>[] = [
  numberInt("id"),
  dateThai("created_at", true),
  dateThai("last_modified", true),
  dateThai("payment_date"),
  simpleText("company_name"),
  simpleText("invoice_number"),
  simpleText("receipt_number"),
  simpleText("expense_group"),
  simpleText("detail"),
  numberFloat("total_amount"),
  simpleText("payment_mode"),
  simpleText("branch_name"),
  simpleText("remark"),
];

function simpleText(key: keyof ExpenseType) {
  return {
    id: expenseFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseType, unknown>) => (
      <DataTableColumnHeader column={column} title={expenseFieldLabel[key]} />
    ),
  };
}

function dateThai(key: keyof ExpenseType, withTime: boolean = false) {
  return {
    id: expenseFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseType, unknown>) => (
      <DataTableColumnHeader column={column} title={expenseFieldLabel[key]} />
    ),
    cell: (row: Row<ExpenseType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(expenseFieldLabel[key]) &&
            new Date(
              row.getValue(expenseFieldLabel[key]) as string
            ).toLocaleString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
            })}
        </div>
      );
    },
    filterFn: (row: Row<ExpenseType>, columnId: string, filterValue: string) =>
      dateFilterFn(row, columnId, filterValue),
  };
}

function numberFloat(key: keyof ExpenseType) {
  return {
    id: expenseFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseType, unknown>) => (
      <DataTableColumnHeader column={column} title={expenseFieldLabel[key]} />
    ),
    cell: (row: Row<ExpenseType>) => {
      return (
        <div className="text-right">
          {(row.getValue(expenseFieldLabel[key]) as number).toLocaleString(
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
      row: Row<ExpenseType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function numberInt(key: keyof ExpenseType) {
  return {
    id: expenseFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseType, unknown>) => (
      <DataTableColumnHeader column={column} title={expenseFieldLabel[key]} />
    ),
    cell: (row: Row<ExpenseType>) => {
      return (
        <div className="text-right">
          {(row.getValue(expenseFieldLabel[key]) as number).toLocaleString(
            "th-TH"
          )}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function dateFilterFn(
  row: Row<ExpenseType>,
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
