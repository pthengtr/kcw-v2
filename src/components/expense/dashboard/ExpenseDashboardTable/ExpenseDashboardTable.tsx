"use client";

import * as React from "react";
import { DataTable } from "@/components/common/DataTable";
import { itemYearColumns } from "./ExpenseDashboardColumn";
import type { ItemYearRow } from "../ExpenseDashboardPage";

type ExpenseDashboardTableProps = {
  /** The rows to render */
  expenseSummary: ItemYearRow[];
  /**
   * A short key that identifies the current dataset identity (e.g. "ALL-<branch>-2025").
   * Used to: (1) remount the internal table, (2) namespace persisted state.
   */
  datasetKey: string;
  /** Optional heading shown above the table */
  title?: string;
};

export default function ExpenseDashboardTable({
  expenseSummary,
  datasetKey,
  title = "สรุปค่าใช้จ่ายทั้งหมด",
}: ExpenseDashboardTableProps) {
  // Make sure the array reference updates when the prop changes
  const data = React.useMemo<ItemYearRow[]>(
    () => expenseSummary ?? [],
    [expenseSummary]
  );

  // Page size: show all by default (or clamp if you prefer)
  const pageSize = data.length || 10;

  return (
    <div className="h-full">
      <DataTable
        // Force remount when the dataset identity changes
        key={`expenseDashboard-${datasetKey}-${pageSize}`}
        // Namespace any persisted table state by dataset identity
        tableName={`expenseDashboard/${datasetKey}`}
        columns={itemYearColumns}
        data={data}
        total={data.length}
        setSelectedRow={undefined}
        initialState={{ pagination: { pageSize } }}
      >
        <div className="flex-1">
          <h2 className="text-xl font-bold px-8">{title}</h2>
        </div>
      </DataTable>
    </div>
  );
}
