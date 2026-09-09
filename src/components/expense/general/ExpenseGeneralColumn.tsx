"use client";

import { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../../common/DataTableColumnHeader";
import { ExpenseGeneralType } from "@/lib/types/models";
import { isPersonalOffsetRow } from "@/lib/expense/personal-offset";

export const defaultExpenseGeneralColumnVisibility = { รหัสเฉพาะ: false };

export const expenseGeneralFieldLabel = {
  entry_date: "วันที่",
  description: "รายละเอียด",
  "expense_item.item_name": "ประเภทค่าใชัจ่าย",
  unit_price: "ราคาต่อหน่วย",
  quantity: "จำนวน",
  "payment_method.payment_description": "ชำระโดย",
  "branch.branch_name": "สาขา",
  remark: "หมายเหตุ",
  "expense_receipt.receipt_number": "บิลอ้างอิง",
};

export const expenseGeneralColumn: ColumnDef<ExpenseGeneralType>[] = [
  dateThai("entry_date"),
  simpleText("description"),
  simpleText("expense_item.item_name"),
  numberFloat("unit_price"),
  numberInt("quantity"),
  {
    id: "บิลอ้างอิง",
    accessorFn: (row) => row.expense_receipt?.receipt_number ?? "",
    header: ({ column }: HeaderContext<ExpenseGeneralType, unknown>) => (
      <DataTableColumnHeader column={column} title="บิลอ้างอิง" />
    ),
    cell: ({ row }: { row: Row<ExpenseGeneralType> }) => {
      const rec = row.original.expense_receipt;
      if (!rec?.receipt_number) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-sm">
          <div className="font-medium">{rec.receipt_number}</div>
          {isPersonalOffsetRow(row.original) ? (
            <div className="text-[10px] text-rose-700">หักส่วนตัว</div>
          ) : null}
        </div>
      );
    },
  },
  simpleText("payment_method.payment_description"),
  simpleText("branch.branch_name"),
  simpleText("remark"),
];

function simpleText(key: keyof typeof expenseGeneralFieldLabel) {
  return {
    id: expenseGeneralFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseGeneralType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseGeneralFieldLabel[key]}
      />
    ),
  };
}

function dateThai(
  key: keyof typeof expenseGeneralFieldLabel,
  withTime: boolean = false
) {
  return {
    id: expenseGeneralFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseGeneralType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseGeneralFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseGeneralType>) => {
      return (
        <div className="text-right">
          {!!row.getValue(expenseGeneralFieldLabel[key]) &&
            new Date(
              row.getValue(expenseGeneralFieldLabel[key]) as string
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
      row: Row<ExpenseGeneralType>,
      columnId: string,
      filterValue: string
    ) => dateFilterFn(row, columnId, filterValue),
  };
}

function numberFloat(key: keyof typeof expenseGeneralFieldLabel) {
  return {
    id: expenseGeneralFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseGeneralType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseGeneralFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseGeneralType>) => {
      const value = row.getValue(expenseGeneralFieldLabel[key]) as number;
      const original = row.original;
      const negative =
        key === "unit_price" && isPersonalOffsetRow(original);
      return (
        <div className={`text-right ${negative ? "font-medium text-rose-700" : ""}`}>
          {value.toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseGeneralType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseGeneralFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function numberInt(key: keyof typeof expenseGeneralFieldLabel) {
  return {
    id: expenseGeneralFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseGeneralType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseGeneralFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseGeneralType>) => {
      return (
        <div className="text-right">
          {(
            row.getValue(expenseGeneralFieldLabel[key]) as number
          ).toLocaleString("th-TH")}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseGeneralType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseGeneralFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function dateFilterFn(
  row: Row<ExpenseGeneralType>,
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
