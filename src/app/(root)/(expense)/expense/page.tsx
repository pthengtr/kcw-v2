"use client";
import CardIcon from "@/components/common/CardIcon";
import CardIconMenu from "@/components/common/CardIconMenu";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export type BranchType = {
  branch_id: number;
  branch_name: string;
};

export default function Branch() {
  const [branches, setBranches] = useState<BranchType[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function getBranch() {
      const query = supabase
        .from("branch")
        .select("*")
        .order("branch_id", { ascending: true })
        .limit(500);

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
                path={`/expense/${branch.branch_id}`}
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
