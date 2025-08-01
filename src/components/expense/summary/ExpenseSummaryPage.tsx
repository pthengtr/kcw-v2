"use client";
import ExpenseReceiptDetail from "@/components/expense/summary/ExpenseReceiptDetail";
import ExpenseReceiptTable, {
  defaultExpenseReceiptColumnVisibility,
} from "@/components/expense/summary/ExpenseReceiptTable";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExpenseSummaryPage() {
  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  useEffect(() => {
    async function getBranchName() {
      const supabase = createClient();

      const query = supabase.from("branch").select("*").eq("branch_id", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    getBranchName();
  }, [branch]);

  return (
    <section className="flex flex-col items-center p-2">
      <h1 className="text-2xl font-bold tracking-wider">{`รายงานบิลค่าใช้จ่าย ${branchName}`}</h1>
      <div className="grid grid-cols-2">
        <div className="p-4">
          <ExpenseReceiptTable
            columnVisibility={defaultExpenseReceiptColumnVisibility}
            paginationPageSize={10}
          />
        </div>
        <div className="p-4">
          <ExpenseReceiptDetail />
        </div>
      </div>
    </section>
  );
}
