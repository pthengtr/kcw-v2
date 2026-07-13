"use client";
import { createClient } from "@/lib/supabase/client";
import CardIconMenu from "@/components/common/CardIconMenu";
import CardIcon from "@/components/common/CardIcon";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BranchType } from "@/lib/types/models";
import { Button } from "@/components/ui/button";
import { ArrowBigLeftDash } from "lucide-react";
import Link from "next/link";

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
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1">
              <Link className="p-4 sm:p-8 md:p-16" href={`/expense`} passHref>
                <Button variant="outline">
                  <ArrowBigLeftDash strokeWidth={1} />
                  กลับ
                </Button>
              </Link>
            </div>
            <h1 className="break-words p-4 text-center text-3xl sm:p-8 sm:text-5xl md:p-12 md:text-6xl">
              {branches[0].branch_name}
            </h1>
            <div className="hidden flex-1 sm:block"></div>
          </div>

          <CardIconMenu>
            <CardIcon
              href={`/expense/company/${branch}/tax-report`}
              label="รายงานภาษีซื้อ"
              icon="Sheet"
            />
            <CardIcon
              href={`/expense/company/${branch}/voucher`}
              label="ใบสำคัญจ่าย"
              icon="FileSpreadsheet"
            />
            <CardIcon
              href={`/expense/company/${branch}/manage`}
              label="จัดการบิล"
              icon="ClipboardList"
            />
            <CardIcon
              href={`/expense/company/${branch}/create`}
              label="สร้างบิลค่าใชัจ่าย"
              icon="ClipboardPlus"
            />
            <CardIcon
              href={`/expense/company/${branch}/credit-note`}
              label="สร้างใบลดหนี้"
              icon="FilePlus2"
            />
          </CardIconMenu>
        </>
      )}
    </>
  );
}
