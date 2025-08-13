// TaxReportColumn.ts
"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import {
  ColumnDef,
  HeaderContext,
  Row,
  CellContext,
} from "@tanstack/react-table";
import { TaxReportRow } from "@/lib/types/models";

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
  supplier_name: "ชื่อผู้ขายสินค้า/บริการ",
  tax_payer_id: "เลขที่ผู้เสียภาษี",
  voucher_description: "รายการสินค้า",
  remark: "หมายเหตุ",
  total_before_tax: "มูลค่าสินค้า",
  vat_only: "ภาษีมูลค่าเพิ่ม",
  total_after_tax: "ยอดสุทธิ",
} as const;

export const taxReportColumn: ColumnDef<TaxReportRow>[] = [
  simpleText("receipt_number"),
  dateThai("receipt_date"),
  simpleTextFullWidth("supplier_name"),
  simpleText("tax_payer_id"),
  moneyRight("total_before_tax", taxReportFieldLabel.total_before_tax),
  moneyRight("vat_only", taxReportFieldLabel.vat_only),
  moneyRight("total_after_tax", taxReportFieldLabel.total_after_tax),
  simpleTextFullWidth("voucher_description"),
  simpleText("remark"),
];

function simpleText<K extends keyof typeof taxReportFieldLabel>(key: K) {
  const title = taxReportFieldLabel[key] ?? (String(key) as string);
  return {
    id: title,
    accessorKey: key as string,
    header: ({ column }: HeaderContext<TaxReportRow, unknown>) => (
      <DataTableColumnHeader column={column} title={title} />
    ),
  } as ColumnDef<TaxReportRow>;
}

function simpleTextFullWidth<K extends keyof typeof taxReportFieldLabel>(
  key: K
) {
  const title = taxReportFieldLabel[key] ?? (String(key) as string);
  return {
    id: title,
    accessorKey: key as string,
    header: ({ column }: HeaderContext<TaxReportRow, unknown>) => (
      <DataTableColumnHeader column={column} title={title} />
    ),
    cell: (ctx: CellContext<TaxReportRow, unknown>) => {
      return <div className="min-w-72 w-full">{ctx.getValue() as string}</div>;
    },
  } as ColumnDef<TaxReportRow>;
}

function dateThai(key: keyof typeof taxReportFieldLabel, withTime = false) {
  const title = taxReportFieldLabel[key] ?? (String(key) as string);
  return {
    id: title,
    accessorKey: key as string,
    header: ({ column }: HeaderContext<TaxReportRow, unknown>) => (
      <DataTableColumnHeader column={column} title={title} />
    ),
    cell: (row: CellContext<TaxReportRow, unknown>) => {
      const raw = row.getValue() as string | undefined;
      return (
        <div className="text-right">
          {!!raw &&
            new Date(raw).toLocaleString("th-TH", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
            })}
        </div>
      );
    },
    filterFn: (row: Row<TaxReportRow>, columnId: string, filterValue: string) =>
      dateFilterFn(row, columnId, filterValue),
  } as ColumnDef<TaxReportRow>;
}

function dateFilterFn(
  row: Row<TaxReportRow>,
  columnId: string,
  filterValue: string
) {
  const raw = row.getValue(columnId) as string;
  return new Date(raw)
    .toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
    .includes(filterValue);
}

function moneyRight<K extends keyof TaxReportRow>(key: K, title: string) {
  return {
    id: title,
    accessorKey: key as string,
    header: ({ column }: HeaderContext<TaxReportRow, unknown>) => (
      <DataTableColumnHeader column={column} title={title} />
    ),
    cell: (ctx: CellContext<TaxReportRow, unknown>) => {
      const n = Number(ctx.getValue());
      return (
        <div className="text-right">
          {Number.isFinite(n)
            ? n.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : ""}
        </div>
      );
    },
  } as ColumnDef<TaxReportRow>;
}
