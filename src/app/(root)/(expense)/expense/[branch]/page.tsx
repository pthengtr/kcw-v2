import { ClipboardList, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CardIconMenu from "@/components/common/CardIconMenu";
import { iconStyle, linkStyle, textStyle } from "@/lib/utils";

type BranchExpenseProps = { params: Promise<{ branch: string }> };

export default async function BranchExpense({ params }: BranchExpenseProps) {
  const { branch } = await params;

  const supabase = createClient();

  const query = supabase
    .from("branch")
    .select("*")
    .eq("branch_id", branch)
    .limit(500);

  const { data: branches, error } = await query;

  if (error) {
    console.log(error);
    return;
  }

  return (
    <>
      <h1 className="text-6xl p-12 text-center">
        {branches && branches[0].branch_name}
      </h1>
      <CardIconMenu>
        <Link href={`/expense/${branch}/summary`} className={linkStyle}>
          <ClipboardList strokeWidth={1} className={iconStyle} />
          <h2 className={textStyle}>รายงานค่าใช้จ่าย</h2>
        </Link>
        <Link href={`/expense/${branch}/create`} className={linkStyle}>
          <FilePlus2 strokeWidth={1} className={iconStyle} />
          <h2 className={textStyle}>สร้าง</h2>
        </Link>
      </CardIconMenu>
    </>
  );
}
