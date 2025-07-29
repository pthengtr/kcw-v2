"use client";

import { useCallback, useContext, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/common/DataTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { expenseItemColumn } from "./ExpenseItemColumn";

export default function ExpenseItemTable() {
  const {
    expenseItems,
    setExpenseItems,
    totalItem,
    setTotalItem,
    setSelectedItem,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const supabase = createClient();

  const getSuppliers = useCallback(
    async function () {
      const query = supabase
        .from("expense_item")
        .select("*", { count: "exact" })
        .order("item_id", { ascending: true })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setExpenseItems(data);
      }
      if (count) setTotalItem(count);
    },
    [setExpenseItems, setTotalItem, supabase]
  );

  useEffect(() => {
    getSuppliers();
  }, [getSuppliers]);

  return (
    <div className="h-full">
      {!!expenseItems && (
        <DataTable
          tableName="supplier"
          columns={expenseItemColumn}
          data={expenseItems}
          total={totalItem}
          setSelectedRow={setSelectedItem}
        >
          <div className="flex gap-4 mr-auto px-8">
            <h2 className="text-2xl font-bold flex-1">{``}</h2>
          </div>
        </DataTable>
      )}
    </div>
  );
}
