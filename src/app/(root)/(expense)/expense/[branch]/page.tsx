import { createClient } from "@/lib/supabase/client";
import CardIconMenu from "@/components/common/CardIconMenu";
import CardIcon from "@/components/common/CardIcon";

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
  );
}
