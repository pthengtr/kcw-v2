"use client";

import { getMonthBasedOn10th } from "@/lib/utils";
import { defaultExpenseVoucherColumnVisibility } from "./ExpenseVoucherColumn";
import ExpenseVoucherSearchForm from "./ExpenseVoucherSearchForm";
import ExpenseVoucherTable from "./ExpenseVoucherTable";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ExpenseVoucherPage() {
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
    <section className="flex flex-col items-center gap-2">
      <h1 className="text-2xl font-bold p-4 tracking-wider">{`ค่าใชัจ่ายบริษัท ${branchName}`}</h1>
      <ExpenseVoucherTable
        paginationPageSize={500}
        columnVisibility={defaultExpenseVoucherColumnVisibility}
      >
        <div className="flex items-center w-full">
          <h2 className="flex-1 justify-self-start p-2 text-xl font-bold tracking-wider">
            ใบสำคัญจ่าย
          </h2>

          <div>
            <ExpenseVoucherSearchForm
              defaultValues={{
                voucher_month: getMonthBasedOn10th().toString(),
              }}
            />
          </div>
        </div>
      </ExpenseVoucherTable>
    </section>
  );
}
