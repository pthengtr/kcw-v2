"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";
import { ExpenseItemType } from "../item/ExpenseItemColumn";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export type ExpenseEntryType = {
  entry_id: number;
  receipt_id: number;
  item_id: number;
  unit_price: number;
  quantity: number;
  entry_detail: string;
  entry_amount: number;
  discount: number;
  expense_item: ExpenseItemType;
};

export const expenseEntryFieldLabel = {
  entry_id: "รายการเลขที่",
  receipt_id: "อ้างอิงจากใบกำกับ",
  item_id: "อ้างอิงประเภทค่าใช้จ่าย",
  unit_price: "ราคาต่อหน่วย",
  quantity: "จำนวน",
  entry_detail: "รายละเอียด",
  entry_amount: "ราคารวม",
  discount: "ส่วนลด",
  "expense_item.item_name": "ประเภทค่าใช้จ่าย",
  "expense_item.category": "หมวด",
};

export const expenseEntryColumn: ColumnDef<ExpenseEntryType>[] = [
  numberInt("entry_id"),
  numberInt("receipt_id"),
  numberInt("item_id"),
  simpleText("entry_detail"),
  simpleText("expense_item.item_name"),
  simpleText("expense_item.category"),
  numberFloat("unit_price"),
  numberFloat("discount"),
  numberFloat("quantity"),
  numberFloat("entry_amount"),
];

function simpleText(key: keyof typeof expenseEntryFieldLabel) {
  return {
    id: expenseEntryFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseEntryType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseEntryFieldLabel[key]}
      />
    ),
  };
}

function numberFloat(key: keyof typeof expenseEntryFieldLabel) {
  return {
    id: expenseEntryFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseEntryType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseEntryFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseEntryType>) => {
      return (
        <div className="text-right">
          {(row.getValue(expenseEntryFieldLabel[key]) as number).toLocaleString(
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
      row: Row<ExpenseEntryType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseEntryFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}

function numberInt(key: keyof typeof expenseEntryFieldLabel) {
  return {
    id: expenseEntryFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseEntryType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseEntryFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseEntryType>) => {
      return (
        <div className="text-right">
          {(row.getValue(expenseEntryFieldLabel[key]) as number).toLocaleString(
            "th-TH"
          )}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseEntryType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseEntryFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}
