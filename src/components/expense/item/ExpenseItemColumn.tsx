"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ColumnDef, HeaderContext } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ExpenseItemType = {
  item_id: number;
  item_name: string;
  expense_category: ExpenseCategoryType;
};

export type ExpenseCategoryType = {
  category_id: number;
  category_name: string;
};

export const expenseItemFieldLabel = {
  item_id: "รหัส",
  item_name: "ประเภทค่าใช้จ่าย",
  "expense_category.category_name": "หมวด",
};

export const expenseItemColumn: ColumnDef<ExpenseItemType>[] = [
  simpleText("item_id"),
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
