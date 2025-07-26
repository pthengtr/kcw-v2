import { createClient } from "@/lib/supabase/client";
import { Store } from "lucide-react";
import Link from "next/link";

const linkStyle =
  "flex flex-col gap-4 items-center py-8 px-12 rounded-lg border-solid border-2 border-slate-800 w-80";
const iconStyle = "w-24 h-24";
const textStyle = "text-2xl";

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
    <section className="flex flex-col items-center h-[90vh]">
      <h1 className="text-6xl p-12">เลือกสาขา</h1>
      <div className="grid grid-cols-4 justify-items-center items-center w-full">
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
      </div>
    </section>
  );
}
