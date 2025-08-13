"use client";

import { useContext, useMemo } from "react";
import { DataTable } from "@/components/common/DataTable";
import { PurchaseContext, PurchaseContextType } from "./PurchaseProvider";
import { makeCartColumns } from "./CartColumn";

export default function CartTable() {
  const { lines, updateLine, removeLine } = useContext(
    PurchaseContext
  ) as PurchaseContextType;

  const columns = useMemo(
    () => makeCartColumns({ updateLine, removeLine }),
    [updateLine, removeLine]
  );

  return (
    <DataTable
      tableName="purchase_cart"
      columns={columns}
      data={lines}
      total={lines.length}
      filterInHeader={false}
    />
  );
}
