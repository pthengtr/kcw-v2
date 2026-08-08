import AppShell from "@/components/nav/AppShell";
import { createClient } from "@/lib/supabase/client";
import { BranchType } from "@/lib/types/models";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();

  const { data: branches, error } = await supabase
    .from("branch")
    .select("*")
    .order("branch_uuid", { ascending: true })
    .limit(500);

  if (error) {
    console.log(error);
  }

  return (
    <AppShell branches={(branches as BranchType[]) ?? []}>{children}</AppShell>
  );
}
