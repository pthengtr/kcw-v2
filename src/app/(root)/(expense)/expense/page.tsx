"use client";
import CardIcon from "@/components/common/CardIcon";
import CardIconMenu from "@/components/common/CardIconMenu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BranchType } from "@/lib/types/models";
import { ArrowBigLeftDash } from "lucide-react";
import Link from "next/link";
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
          <div className="flex">
            <div className="flex-1 flex">
              <Link className="p-16" href={`/home`} passHref>
                <Button variant="outline">
                  <ArrowBigLeftDash strokeWidth={1} />
                  กลับ
                </Button>
              </Link>
            </div>
            <h1 className="text-6xl p-12 text-center">ค่าใช้จ่าย</h1>
            <div className="flex-1"></div>
          </div>
          <CardIconMenu>
            <CardIcon
              href="/expense/dashboard"
              label="ภาพรวม"
              icon="ChartLine"
            />
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
