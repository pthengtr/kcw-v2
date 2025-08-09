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
        >
          <div className="flex-1">
            <h2 className="text-xl font-bold px-8">สรุปค่าใช้จ่ายทั้งหมด</h2>
          </div>
        </DataTable>
      )}
    </div>
  );
}
