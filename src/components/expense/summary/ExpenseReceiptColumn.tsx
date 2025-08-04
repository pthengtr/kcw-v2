"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ExpenseReceiptType } from "@/lib/types/models";
import {
  CellContext,
  ColumnDef,
  HeaderContext,
  Row,
} from "@tanstack/react-table";
import { Check } from "lucide-react";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const defaultExpenseReceiptColumnVisibility = {
  รายการเลขที่: false,
  บริษัท: true,
  เลขที่ใบแจ้งหนี้: false,
  วันที่ใบแจ้งหนี้: false,
  เลขที่ใบกำกับภาษี: true,
  วันที่ใบกำกับภาษี: true,
  เลขที่ใบเสร็จรับเงิน: false,
  วันที่ใบเสร็จรับเงิน: false,
  ก่อนภาษี: false,
  ชำระโดย: true,
  หมายเหตุ: false,
  สาขา: false,
  พนักงาน: false,
  ส่วนลดท้ายบิล: true,
  ส่งบัญชี: false,
};

export const expenseReceiptFieldLabel = {
  receipt_uuid: "รายการเลขที่",
  "supplier.supplier_name": "บริษัท",
  invoice_number: "เลขที่เอกสาร",
  invoice_date: "วันที่เอกสาร",
  tax_invoice_number: "เลขที่ใบกำกับภาษี",
  tax_invoice_date: "วันที่ใบกำกับภาษี",
  receipt_number: "เลขที่ใบเสร็จรับเงิน",
  receipt_date: "วันที่ใบเสร็จรับเงิน",
  total_amount: "ก่อนภาษี",
  "payment_method.payment_description": "ชำระโดย",
  remark: "หมายเหตุ",
  "branch.branch_name": "สาขา",
  user_id: "พนักงาน",
  discount: "ส่วนลดท้ายบิล",
  submit_to_account: "ส่งบัญชี",
};

export const expenseReceiptColumn: ColumnDef<ExpenseReceiptType>[] = [
  numberInt("receipt_uuid"),
  simpleText("supplier.supplier_name"),
  simpleText("invoice_number"),
  dateThai("invoice_date"),
  simpleText("tax_invoice_number"),
  dateThai("tax_invoice_date"),
  simpleText("receipt_number"),
  dateThai("receipt_date"),
  numberFloat("total_amount"),
  numberFloat("discount"),
  taxOnly(),
  withholdingOnly(),
  totalAfterTax(),
  totalNet(),
  simpleText("payment_method.payment_description"),
  simpleText("branch.branch_name"),
  simpleText("remark"),
  simpleText("user_id"),
  submitToAccount(),
];

function taxOnly() {
  return {
    id: "ภาษี",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="ภาษี" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const taxOnly = (row.total_amount - row.discount) * (row.vat / 100);
      return (
        <div className="text-right">
          {taxOnly.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  };
}

function withholdingOnly() {
  return {
    id: "หัก ณ ที่จ่าย",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="หัก ณ ที่จ่าย" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const withholdingOnly =
        (row.total_amount - row.discount) * (row.withholding / 100);
      return (
        <div className="text-right">
          {withholdingOnly.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  };
}

function totalAfterTax() {
  return {
    id: "ราคาหลังภาษี",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="ราคาหลังภาษี" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const taxOnly = (row.total_amount - row.discount) * (row.vat / 100);
      const totalAfterTax = row.total_amount - row.discount + taxOnly;
      return (
        <div className="text-right">
          {totalAfterTax.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  };
}

function totalNet() {
  return {
    id: "ราคาสุทธิ",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="ราคาสุทธิ" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const taxOnly = (row.total_amount - row.discount) * (row.vat / 100);
      const withholdingOnly =
        (row.total_amount - row.discount) * (row.withholding / 100);
      const totalNet =
        row.total_amount - row.discount + taxOnly - withholdingOnly;

      return (
        <div className="text-right">
          {totalNet.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  };
}

function submitToAccount() {
  return {
    id: "ส่งบัญชี",
    accessorKey: "submit_to_account",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="ส่งบัญชี" />
    ),
    cell: (row: CellContext<ExpenseReceiptType, unknown>) => {
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
  };
}

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
