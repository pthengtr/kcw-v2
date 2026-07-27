"use client";
import BackButton from "@/components/common/BackButton";
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
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 p-4 sm:p-8 md:p-16">
              <BackButton href="/home" />
            </div>
            <h1 className="p-4 text-center text-3xl sm:p-8 sm:text-5xl md:p-12 md:text-6xl">
              ค่าใช้จ่าย
            </h1>
            <div className="hidden flex-1 sm:block"></div>
          </div>
          <CardIconMenu>
            <CardIcon
              href="/expense/company"
              label="ค่าใช้จ่ายบริษัท"
              icon="Building2"
            />
            <CardIcon
              href="/expense/general"
              label="ค่าใช้จ่ายทั่วไป"
              icon="Users"
            />
            <CardIcon
              href="/expense/item"
              label="ประเภทค่าใช้จ่าย"
              icon="SquareMenu"
            />
          </CardIconMenu>
        </>
      )}
    </>
  );
}
