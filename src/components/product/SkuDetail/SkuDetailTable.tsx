// components/sku/SkuDetailTable.tsx
"use client";

import { ReactNode } from "react";
import { DataTable } from "../../common/DataTable";
import { ColumnDef } from "@tanstack/react-table";

type Props<TData> = {
  tableName: string;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  headerSlot?: ReactNode; // optional header content
};

export default function SkuDetailTable<TData>({
  tableName,
  columns,
  data,
  headerSlot,
}: Props<TData>) {
  const noop = () => {};
  return (
    <DataTable
      tableName={tableName}
      columns={columns}
      data={data}
      total={data?.length ?? 0}
      setSelectedRow={noop}
    >
      {headerSlot}
    </DataTable>
  );
}
