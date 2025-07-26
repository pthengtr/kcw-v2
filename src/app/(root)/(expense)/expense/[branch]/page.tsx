import { ClipboardList, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const linkStyle =
  "flex flex-col gap-4 items-center py-8 px-12 rounded-lg border-solid border-2 border-slate-800 w-80";
const iconStyle = "w-24 h-24";
const textStyle = "text-2xl";

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
    <section className="flex flex-col items-center h-[90vh]">
      <h1 className="text-6xl p-12">{branches && branches[0].branch_name}</h1>
      <div className="grid grid-cols-4 justify-items-center items-center w-full">
        <Link href={`/expense/${branch}/summary`} className={linkStyle}>
          <ClipboardList strokeWidth={1} className={iconStyle} />
          <h2 className={textStyle}>รายงานค่าใช้จ่าย</h2>
        </Link>
        <Link href={`/expense/${branch}/create`} className={linkStyle}>
          <FilePlus2 strokeWidth={1} className={iconStyle} />
          <h2 className={textStyle}>สร้าง</h2>
        </Link>
      </div>
    </section>
  );
}
