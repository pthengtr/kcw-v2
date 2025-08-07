"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ExpenseReceiptType } from "@/lib/types/models";
import {
  CellContext,
  ColumnDef,
  HeaderContext,
  Row,
} from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const defaultTaxReportColumnVisibility = {
  ลำดับที่: true,
  เลขที่ใบกำกับภาษี: true,
  วันที่: true,
  "ชื่อผู้ขายสินค้า/บริการ": true,
  เลขที่ผู้เสียภาษี: true,
  มูลค่าสินค้า: true,
  ภาษีมูลค่าเพิ่ม: true,
  ยอดสุทธิ: true,
  รายการสินค้า: true,
  หมายเหตุ: true,
};

export const taxReportFieldLabel = {
  receipt_number: "เลขที่ใบกำกับภาษี",
  receipt_date: "วันที่",
  "supplier.supplier_name": "ชื่อผู้ขายสินค้า/บริการ",
  "supplier.supplier_tax_info.tax_payer_id": "เลขที่ผู้เสียภาษี",
  // total amount before vat
  // vat
  // total net
  voucher_description: "รายการสินค้า",
  remark: "หมายเหตุ",
};

export const taxReportColumn: ColumnDef<ExpenseReceiptType>[] = [
  simpleText("receipt_number"),
  dateThai("receipt_date"),
  simpleTextFullWidth("supplier.supplier_name"),
  simpleText("supplier.supplier_tax_info.tax_payer_id"),
  totalBeforeTax(),
  taxOnly(),
  totalAfterTax(),
  simpleTextFullWidth("voucher_description"),
  simpleText("remark"),
];

function simpleText(key: keyof typeof taxReportFieldLabel) {
  return {
    id: taxReportFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title={taxReportFieldLabel[key]} />
    ),
  };
}

function dateThai(
  key: keyof typeof taxReportFieldLabel,
  withTime: boolean = false
) {
  return {
    id: taxReportFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title={taxReportFieldLabel[key]} />
    ),
    cell: (row: Row<ExpenseReceiptType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(taxReportFieldLabel[key]) &&
            new Date(
              row.getValue(taxReportFieldLabel[key]) as string
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

function simpleTextFullWidth(key: keyof typeof taxReportFieldLabel) {
  return {
    id: taxReportFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title={taxReportFieldLabel[key]} />
    ),
    cell: (row: CellContext<ExpenseReceiptType, unknown>) => {
      return <div className="min-w-72 w-full">{row.getValue() as string}</div>;
    },
  };
}

function taxOnly() {
  return {
    id: "ภาษีมูลค่าเพิ่ม",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="ภาษีมูลค่าเพิ่ม" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const taxOnly =
        (row.total_amount - row.discount - row.tax_exempt) * (row.vat / 100);
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

function totalAfterTax() {
  return {
    id: "ยอดสุทธิ",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="ยอดสุทธิ" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const taxOnly =
        (row.total_amount - row.discount - row.tax_exempt) * (row.vat / 100);
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

function totalBeforeTax() {
  return {
    id: "มูลค่าสินค้า",
    accessorKey: "total_amount",
    header: ({ column }: HeaderContext<ExpenseReceiptType, unknown>) => (
      <DataTableColumnHeader column={column} title="มูลค่าสินค้า" />
    ),
    cell: (info: CellContext<ExpenseReceiptType, unknown>) => {
      const row = info.row.original;
      const totalBeforeTax = row.total_amount - row.discount;
      return (
        <div className="text-right">
          {totalBeforeTax.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
  };
}
