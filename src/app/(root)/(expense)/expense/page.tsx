"use client";
import CardIcon from "@/components/common/CardIcon";
import CardIconMenu from "@/components/common/CardIconMenu";
import { createClient } from "@/lib/supabase/client";
import { BranchType } from "@/lib/types/models";
import { useEffect, useState } from "react";

export default function Branch() {
  const [branches, setBranches] = useState<BranchType[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function getBranch() {
      const query = supabase.from("branch").select("*");

      const { data: branches, error } = await query;

      if (error) {
        console.log(error);
      }

      if (branches) setBranches(branches);
    }

    getBranch();
  }, [supabase]);

  return (
    <>
      {branches && (
        <>
          <h1 className="text-6xl p-12 text-center tracking-widest">
            ค่าใช้จ่าย
          </h1>
          <CardIconMenu>
            {branches.map((branch) => (
              <CardIcon
                key={branch.branch_name}
                path={`/expense/${branch.branch_uuid}`}
                description={branch.branch_name}
                icon="Store"
              />
            ))}
            <CardIcon
              path="/expense/item"
              description="ประเภทค่าใช้จ่าย"
              icon="SquareMenu"
            />
          </CardIconMenu>
        </>
      )}
    </>
  );
}
