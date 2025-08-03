"use client";

import { BranchType } from "@/app/(root)/(expense)/expense/page";
import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { SupplierType } from "@/components/supplier/SupplierColumn";
import { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";
import { Check } from "lucide-react";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export type PaymentMethodType = {
  payment_id: number;
  payment_description: string;
};

export type ExpenseReceiptType = {
  receipt_id: number;
  supplier_id: number;
  invoice_number: string;
  invoice_date: string;
  tax_invoice_number: string;
  tax_invoice_date: string;
  receipt_number: string;
  receipt_date: string;
  total_amount: number;
  payment_id: number;
  remark: string;
  branch_id: number;
  user_id: string;
  vat: number;
  discount: number;
  withholding: number;
  submit_to_account: boolean;
  branch: BranchType;
  payment_method: PaymentMethodType;
  supplier: SupplierType;
};

export const expenseReceiptFieldLabel = {
  receipt_id: "รายการเลขที่",
  "supplier.supplier_name": "บริษัท",
  invoice_number: "เลขที่ใบแจ้งหนี้",
  invoice_date: "วันที่ใบแจ้งหนี้",
  tax_invoice_number: "เลขที่ใบกำกับภาษี",
  tax_invoice_date: "วันที่ใบกำกับภาษี",
  receipt_number: "เลขที่ใบเสร็จรับเงิน",
  receipt_date: "วันที่ใบเสร็จรับเงิน",
  total_amount: "จำนวนเงินก่อนภาษี",
  "payment_method.payment_description": "ชำระโดย",
  remark: "หมายเหตุ",
  "branch.branch_name": "สาขา",
  user_id: "พนักงาน",
  vat: "ภาษี",
  discount: "ส่วนลดท้ายบิล",
  withholding: "หัก ณ ที่จ่าย",
  submit_to_account: "ส่งบัญชี",
};

export const expenseReceiptColumn: ColumnDef<ExpenseReceiptType>[] = [
  numberInt("receipt_id"),
  simpleText("supplier.supplier_name"),
  simpleText("invoice_number"),
  dateThai("invoice_date"),
  simpleText("tax_invoice_number"),
  dateThai("tax_invoice_date"),
  simpleText("receipt_number"),
  dateThai("receipt_date"),
  numberFloat("total_amount"),
  numberFloat("discount"),
  numberFloat("vat"),
  numberFloat("withholding"),
  simpleText("payment_method.payment_description"),
  simpleText("branch.branch_name"),
  simpleText("remark"),
  simpleText("user_id"),
  {
    id: "ส่งบัญชี",
    accessorKey: "submit_to_account",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="หลักฐานการจ่าย" />
    ),
    cell: (row) => {
      return (
        <div className="text-right">
          {row.getValue() ? (
            <div className="flex justify-center">
              <Check />
            </div>
          ) : (
            ""
          )}
        </div>
      );
    },
  },
];

function simpleText(key: keyof typeof expenseReceiptFieldLabel) {
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

function dateThai(
  key: keyof typeof expenseReceiptFieldLabel,
  withTime: boolean = false
) {
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

function numberFloat(key: keyof typeof expenseReceiptFieldLabel) {
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

function numberInt(key: keyof typeof expenseReceiptFieldLabel) {
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
