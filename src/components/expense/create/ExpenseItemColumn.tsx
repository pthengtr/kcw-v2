"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ColumnDef, HeaderContext } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ExpenseItemType = {
  item_id: number;
  description: string;
  category: string;
};

export const expenseItemFieldLabel = {
  item_id: "รหัส",
  description: "ประเภทค่าใช้จ่าย",
  category: "หมวด",
};

export const expenseItemColumn: ColumnDef<ExpenseItemType>[] = [
  simpleText("item_id"),
  simpleText("description"),
  simpleText("category"),
];

function simpleText(key: keyof ExpenseItemType) {
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
