"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ExtendedExpenseReceiptType } from "@/lib/types/models";
import {
  CellContext,
  ColumnDef,
  HeaderContext,
  Row,
} from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const defaultExpenseVoucherColumnVisibility = {
  เลขที่ใบสำคัญจ่าย: true,
  เลขที่เอกสาร: true,
  วันที่: true,
  รายละเอียด: true,
  จำนวนเงินสุทธิ: true,
};

export const expenseVoucherFieldLabel = {
  receipt_number: "เลขที่เอกสาร",
  receipt_date: "วันที่",
  voucher_description: "รายละเอียด",
  voucherId: "เลขที่ใบสำคัญจ่าย",
  totalNet: "จำนวนเงินสุทธิ",
};

export const expenseVoucherColumn: ColumnDef<ExtendedExpenseReceiptType>[] = [
  // {
  //   id: "เลขที่ใบสำคัญจ่าย",
  //   accessorKey: "receipt_number",
  //   header: ({
  //     column,
  //   }: HeaderContext<ExtendedExpenseReceiptType, unknown>) => (
  //     <DataTableColumnHeader column={column} title="เลขที่ใบสำคัญจ่าย" />
  //   ),
  //   cell: ({ row }) => {
  //     return row.original.voucherId;
  //   },
  // },
  simpleText("voucherId"),
  simpleText("receipt_number"),
  dateThai("receipt_date"),
  simpleTextFullWidth("voucher_description"),
  numberFloat("totalNet"),
];

function simpleText(key: keyof typeof expenseVoucherFieldLabel) {
  return {
    id: expenseVoucherFieldLabel[key],
    accessorKey: key,
    header: ({
      column,
    }: HeaderContext<ExtendedExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseVoucherFieldLabel[key]}
      />
    ),
  };
}

function dateThai(
  key: keyof typeof expenseVoucherFieldLabel,
  withTime: boolean = false
) {
  return {
    id: expenseVoucherFieldLabel[key],
    accessorKey: key,
    header: ({
      column,
    }: HeaderContext<ExtendedExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseVoucherFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExtendedExpenseReceiptType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(expenseVoucherFieldLabel[key]) &&
            new Date(
              row.getValue(expenseVoucherFieldLabel[key]) as string
            ).toLocaleString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
            })}
        </div>
      );
    },
    filterFn: (
      row: Row<ExtendedExpenseReceiptType>,
      columnId: string,
      filterValue: string
    ) => dateFilterFn(row, columnId, filterValue),
  };
}

function dateFilterFn(
  row: Row<ExtendedExpenseReceiptType>,
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

function numberFloat(key: keyof typeof expenseVoucherFieldLabel) {
  return {
    id: expenseVoucherFieldLabel[key],
    accessorKey: key,
    header: ({
      column,
    }: HeaderContext<ExtendedExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseVoucherFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExtendedExpenseReceiptType>) => {
      return (
        <div className="text-right">
          {(
            row.getValue(expenseVoucherFieldLabel[key]) as number
          ).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
    filterFn: (
      row: Row<ExtendedExpenseReceiptType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseVoucherFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function simpleTextFullWidth(key: keyof typeof expenseVoucherFieldLabel) {
  return {
    id: expenseVoucherFieldLabel[key],
    accessorKey: key,
    header: ({
      column,
    }: HeaderContext<ExtendedExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseVoucherFieldLabel[key]}
      />
    ),
    cell: (row: CellContext<ExtendedExpenseReceiptType, unknown>) => {
      return <div className="min-w-96 w-full">{row.getValue() as string}</div>;
    },
  };
}
