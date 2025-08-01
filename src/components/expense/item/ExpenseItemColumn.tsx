"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";
import { ExpenseCategoryType } from "./ExpenseCategoryColumn";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ExpenseItemType = {
  item_id: number;
  item_name: string;
  category_id: number;
  expense_category: ExpenseCategoryType;
};

export const expenseItemFieldLabel = {
  item_id: "รหัส",
  item_name: "ประเภทค่าใช้จ่าย",
  "expense_category.category_name": "หมวด",
};

export const expenseItemColumn: ColumnDef<ExpenseItemType>[] = [
  numberInt("item_id"),
  simpleText("item_name"),
  simpleText("expense_category.category_name"),
];

function simpleText(key: keyof typeof expenseItemFieldLabel) {
  return {
    id: expenseItemFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseItemType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseItemFieldLabel[key]}
      />
    ),
  };
}

function numberInt(key: keyof typeof expenseItemFieldLabel) {
  return {
    id: expenseItemFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseItemType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseItemFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseItemType>) => {
      return (
        <div className="text-right">
          {(row.getValue(expenseItemFieldLabel[key]) as number).toLocaleString(
            "th-TH"
          )}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseItemType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseItemFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}
