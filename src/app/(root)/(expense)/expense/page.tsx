import CardIconMenu from "@/components/common/CardIconMenu";
import { createClient } from "@/lib/supabase/client";
import { iconStyle, linkStyle, textStyle } from "@/lib/utils";
import { Store } from "lucide-react";
import Link from "next/link";

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
      <h1 className="text-6xl p-12 text-center">เลือกสาขา</h1>
      <CardIconMenu>
        {branches &&
          branches?.map((branch) => (
            <Link
              key={branch.branch_name}
              href={`/expense/${branch.branch_id}`}
              className={linkStyle}
            >
              <Store strokeWidth={1} className={iconStyle} />
              <h2 className={textStyle}>{branch.branch_name}</h2>
            </Link>
          ))}
      </CardIconMenu>
    </>
  );
}
