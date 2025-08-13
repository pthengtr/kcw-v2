"use client";

import { useContext, useMemo } from "react";
import { PosContext, PosContextType } from "./PosProvider";
import { makePosCartColumns } from "./PosCartColumns";
import { DataTable } from "@/components/common/DataTable";

export default function PosCartTable() {
  const { lines, updateLine, removeLine } = useContext(
    PosContext
  ) as PosContextType;

  const columns = useMemo(
    () => makePosCartColumns({ updateLine, removeLine }),
    [updateLine, removeLine]
  );

  return (
    <DataTable
      tableName="pos_cart"
      columns={columns}
      data={lines}
      total={lines.length}
      filterInHeader={false}
    />
  );
}
