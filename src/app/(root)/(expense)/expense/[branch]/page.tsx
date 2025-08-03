"use client";
import { createClient } from "@/lib/supabase/client";
import CardIconMenu from "@/components/common/CardIconMenu";
import CardIcon from "@/components/common/CardIcon";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BranchType } from "@/lib/types/models";

export default function BranchExpense() {
  const { branch } = useParams();

  const [branches, setBranches] = useState<BranchType[]>();

  const supabase = createClient();

  useEffect(() => {
    async function getBranch() {
      const query = supabase
        .from("branch")
        .select("*")
        .eq("branch_uuid", branch);

      const { data: branches, error } = await query;

      console.log("this is branches", branches);

      if (error) {
        console.log(error);
      }

      if (branches) setBranches(branches);
    }

    getBranch();
  }, [branch, supabase]);

  return (
    <>
      {branches && (
        <>
          <h1 className="text-6xl p-12 text-center">
            {branches[0].branch_name}
          </h1>
          <CardIconMenu>
            <CardIcon
              path={`/expense/${branch}/summary`}
              description="รายงานค่าใช้จ่าย"
              icon="ClipboardList"
            />
            <CardIcon
              path={`/expense/${branch}/create`}
              description="สร้าง"
              icon="FilePlus2"
            />
          </CardIconMenu>
        </>
      )}
    </>
  );
}
