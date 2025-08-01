import CardIcon from "@/components/common/CardIcon";
import CardIconMenu from "@/components/common/CardIconMenu";
import { createClient } from "@/lib/supabase/client";

export type BranchType = {
  branch_id: number;
  branch_name: string;
};

export default async function Branch() {
  const supabase = createClient();

  const query = supabase
    .from("branch")
    .select("*")
    .order("branch_id", { ascending: true })
    .limit(500);

  const { data: branches, error } = await query;

  if (error) {
    console.log(error);
  }

  return (
    <>
      <h1 className="text-6xl p-12 text-center tracking-widest">ค่าใช้จ่าย</h1>
      <CardIconMenu>
        {branches &&
          branches?.map((branch) => (
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
  );
}
