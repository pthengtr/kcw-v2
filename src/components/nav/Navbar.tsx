import { createClient } from "@/lib/supabase/client";
import { BranchType } from "@/lib/types/models";
import NavbarClient from "./NavbarClient";

export default async function Navbar() {
  const supabase = createClient();

  const query = supabase
    .from("branch")
    .select("*")
    .order("branch_uuid", { ascending: true })
    .limit(500);

  const { data: branches, error } = await query;

  if (error) {
    console.log(error);
  }

  return <NavbarClient branches={(branches as BranchType[]) ?? []} />;
}
