"use client";

import { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";
import { SupplierType } from "@/lib/types/models";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const supplierFieldLabel = {
  supplier_uuid: "รหัสเฉพาะ",
  supplier_code: "ชื่อย่อบริษัท",
  supplier_name: "ชื่อบริษัท",
};

export const supplierColumn: ColumnDef<SupplierType>[] = [
  simpleText("supplier_uuid"),
  simpleText("supplier_code"),
  simpleText("supplier_name"),
];

function simpleText(key: keyof SupplierType) {
  return {
    id: supplierFieldLabel[key],
    accessorKey: key,
    header: ({ column }: HeaderContext<SupplierType, unknown>) => (
      <DataTableColumnHeader column={column} title={supplierFieldLabel[key]} />
    ),
  };
}
