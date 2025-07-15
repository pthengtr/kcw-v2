"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ProductType = {
  BCODE: string;
  DESCR: string;
  PRICE1: number;
};
export const productColumns: ColumnDef<ProductType>[] = [
  {
    id: "รหัสสินค้า",
    accessorKey: "BCODE",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="รหัสสินค้า" />
    ),
  },
  {
    id: "ชื่อสินค้า",
    accessorKey: "DESCR",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ชื่อสินค้า" />
    ),
  },
  {
    id: "ราคา",
    accessorKey: "PRICE1",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ราคา" />
    ),
    cell: (row) => {
      return (
        <div className="text-right">
          {(row.getValue() as number).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      return row.getValue(columnId) === parseFloat(filterValue);
    },
  },
];
