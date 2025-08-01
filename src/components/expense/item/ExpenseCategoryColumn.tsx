"use client";

import { DataTableColumnHeader } from "@/components/common/DataTableColumnHeader";
import { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ExpenseCategoryType = {
  category_id: number;
  category_name: string;
};

export const expenseCategoryFieldLabel = {
  category_id: "รหัสหมวด",
  category_name: "หมวด",
};

export const expenseCategoryColumn: ColumnDef<ExpenseCategoryType>[] = [
  numberInt("category_id"),
  simpleText("category_name"),
];

function simpleText(key: keyof typeof expenseCategoryFieldLabel) {
  return {
    id: expenseCategoryFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseCategoryType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseCategoryFieldLabel[key]}
      />
    ),
  };
}

function numberInt(key: keyof typeof expenseCategoryFieldLabel) {
  return {
    id: expenseCategoryFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<ExpenseCategoryType, unknown>) => (
      <DataTableColumnHeader
        column={column}
        title={expenseCategoryFieldLabel[key]}
      />
    ),
    cell: (row: Row<ExpenseCategoryType>) => {
      return (
        <div className="text-right">
          {(
            row.getValue(expenseCategoryFieldLabel[key]) as number
          ).toLocaleString("th-TH")}
        </div>
      );
    },
    filterFn: (
      row: Row<ExpenseCategoryType>,
      columnId: string,
      filterValue: string
    ) => {
      return (row.getValue(expenseCategoryFieldLabel[key]) as number)
        .toString()
        .includes(filterValue);
    },
  };
}
