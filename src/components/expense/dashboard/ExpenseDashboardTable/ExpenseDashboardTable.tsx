"use client";

import { DataTable } from "@/components/common/DataTable";
import { itemYearColumns } from "./ExpenseDashboardColumn";
import { ItemYearRow } from "../ExpenseDashboardPage";

type ExpenseDashboardTableProps = {
  expenseSummary: ItemYearRow[];
};

export default function ExpenseDashboardTable({
  expenseSummary,
}: ExpenseDashboardTableProps) {
  return (
    <div className="h-full">
      {!!expenseSummary && (
        <DataTable
          tableName="expenseDashboard"
          columns={itemYearColumns}
          data={expenseSummary}
          total={expenseSummary.length}
          setSelectedRow={undefined}
          initialState={{ pagination: { pageSize: expenseSummary.length } }}
        ></DataTable>
      )}
    </div>
  );
}
