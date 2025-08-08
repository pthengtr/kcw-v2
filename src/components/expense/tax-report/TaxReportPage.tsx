"use client";

import { useEffect, useState } from "react";
import ExpensePageHeader from "../ExpensePageHeader";
import { defaultTaxReportColumnVisibility } from "./TaxReportColumn";
import TaxReportTable from "./TaxReportTable";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TaxReportPage() {
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
    <section className="flex flex-col items-center p-4">
      <ExpensePageHeader pageTitle={`รายงานภาษีซื้อ ${branchName}`} />
      <div className="w-fit h-[90vh] p-8">
        <TaxReportTable
          columnVisibility={defaultTaxReportColumnVisibility}
          paginationPageSize={500}
        />
      </div>
    </section>
  );
}
