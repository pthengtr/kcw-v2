"use client";
import ExpenseReceiptDetail from "@/components/expense/summary/ExpenseReceiptDetail";
import ExpenseReceiptTable, {
  defaultExpenseReceiptColumnVisibility,
} from "@/components/expense/summary/ExpenseReceiptTable";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Plus, Store } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExpenseSummaryPage() {
  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  useEffect(() => {
    async function getBranchName() {
      const supabase = createClient();

      const query = supabase
        .from("branch")
        .select("*")
        .eq("branch_uuid", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    getBranchName();
  }, [branch]);

  return (
    <section className="flex flex-col items-center p-2">
      <div className="flex w-full px-2">
        <div className="flex-1 flex gap-2">
          <Link className="" href={`/expense/${branch}/create`} passHref>
            <Button variant="outline">
              <Plus />
              สร้างบิลค่าใช้จ่ายใหม่
            </Button>
          </Link>
          <Link className="" href={`/expense`} passHref>
            <Button variant="outline">
              <Store />
              เลือกสาขา
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-wider">{`รายงานบิลค่าใช้จ่าย ${branchName}`}</h1>
        <div className="flex-1"></div>
      </div>

      <div className="flex flex-col w-full">
        <div className="p-2">
          <ExpenseReceiptTable
            columnVisibility={defaultExpenseReceiptColumnVisibility}
            paginationPageSize={10}
          >
            <h2 className="text-xl font-bold flex-1">{`รายการบิลค่าใช้จ่าย`}</h2>
          </ExpenseReceiptTable>
        </div>
        <div className="p-2 flex-1">
          <ExpenseReceiptDetail />
        </div>
      </div>
    </section>
  );
}
