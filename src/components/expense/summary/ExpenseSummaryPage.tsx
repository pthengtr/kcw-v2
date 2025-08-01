"use client";
import ExpenseReceiptDetail from "@/components/expense/summary/ExpenseReceiptDetail";
import ExpenseReceiptTable, {
  defaultExpenseReceiptColumnVisibility,
} from "@/components/expense/summary/ExpenseReceiptTable";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { FilePlus2 } from "lucide-react";
import Link from "next/link";
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
      <div className="flex w-full px-2">
        <Link className="flex-1" href={`/expense/${branch}/create`} passHref>
          <Button variant="default">
            <FilePlus2 />
            สร้างบิลค่าใช้จ่ายใหม่
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-wider">{`รายงานบิลค่าใช้จ่าย ${branchName}`}</h1>
        <div className="flex-1"></div>
      </div>

      <div className="flex w-full">
        <div className="p-2">
          <ExpenseReceiptTable
            columnVisibility={defaultExpenseReceiptColumnVisibility}
            paginationPageSize={10}
          />
        </div>
        <div className="p-2 flex-1">
          <ExpenseReceiptDetail />
        </div>
      </div>
    </section>
  );
}
