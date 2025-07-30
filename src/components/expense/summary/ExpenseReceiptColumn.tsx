"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export type ExpenseReceiptType = {
  receipt_id: number;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  tax_invoice_number: string;
  tax_invoice_date: string;
  receipt_number: string;
  receipt_date: string;
  total_amount: number;
  payment_method: string;
  remark: string;
  branch_id: number;
  user_id: string;
};

export const expenseReceiptFieldLabel = {
  receipt_id: "รายการเลขที่",
  vendor_name: "บริษัท",
  invoice_number: "เลขที่ใบแจ้งหนี้",
  invoice_date: "วันที่ใบแจ้งหนี้",
  tax_invoice_number: "เลขที่ใบกำกับภาษี",
  tax_invoice_date: "วันที่ใบกำกับภาษี",
  receipt_number: "เลขที่ใบเสร็จรับเงิน",
  receipt_date: "วันที่ใบเสร็จรับเงิน",
  total_amount: "จำนวนเงิน",
  payment_method: "ชำระโดย",
  remark: "หมายเหตุ",
  branch_id: "สาขา",
  user_id: "พนักงาน",
};

export const expenseReceiptColumn: ColumnDef<ExpenseReceiptType>[] = [
  numberInt("receipt_id"),
  simpleText("vendor_name"),
  simpleText("invoice_number"),
  dateThai("invoice_date"),
  simpleText("tax_invoice_number"),
  dateThai("tax_invoice_date"),
  simpleText("receipt_number"),
  dateThai("receipt_date"),
  numberFloat("total_amount"),
  simpleText("payment_method"),
  simpleText("branch_id"),
  simpleText("remark"),
  simpleText("user_id"),
];

function simpleText(key: keyof ExpenseReceiptType) {
  return {
    id: expenseReceiptFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseReceiptFieldLabel[key]}
      />
    ),
  };
}

function dateThai(key: keyof ExpenseReceiptType, withTime: boolean = false) {
  return {
    id: expenseReceiptFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseReceiptFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseReceiptType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(expenseReceiptFieldLabel[key]) &&
            new Date(
              row.getValue(expenseReceiptFieldLabel[key]) as string
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
      row: Row<ExpenseReceiptType>,
      columnId: string,
      filterValue: string
    ) => dateFilterFn(row, columnId, filterValue),
  };
}

function numberFloat(key: keyof ExpenseReceiptType) {
  return {
    id: expenseReceiptFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseReceiptFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseReceiptType>) => {
      return (
        <div className="text-right">
          {(
            row.getValue(expenseReceiptFieldLabel[key]) as number
          ).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseReceiptType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseReceiptFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function numberInt(key: keyof ExpenseReceiptType) {
  return {
    id: expenseReceiptFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseReceiptFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseReceiptType>) => {
      return (
        <div className="text-right">
          {(
            row.getValue(expenseReceiptFieldLabel[key]) as number
          ).toLocaleString("th-TH")}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseReceiptType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseReceiptFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function dateFilterFn(
  row: Row<ExpenseReceiptType>,
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
