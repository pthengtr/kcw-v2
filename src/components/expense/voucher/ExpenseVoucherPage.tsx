"use client";

import { defaultExpenseVoucherColumnVisibility } from "./ExpenseVoucherColumn";
import ExpenseVoucherTable from "./ExpenseVoucherTable";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ExpensePageHeader from "../ExpensePageHeader";

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
    <section className="flex flex-col items-center gap-2 h-[90vh] p-4">
      <ExpensePageHeader pageTitle={`ใบสำคัญจ่าย ${branchName}`} />
      <ExpenseVoucherTable
        paginationPageSize={500}
        columnVisibility={defaultExpenseVoucherColumnVisibility}
      ></ExpenseVoucherTable>
    </section>
  );
}
