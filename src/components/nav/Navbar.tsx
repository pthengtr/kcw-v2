import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import LogoutButton from "../auth/LogoutButton";
import { Button } from "../ui/button";
import { createClient } from "@/lib/supabase/client";
import NavbarExpenseDropdownMenu from "./NavbarExpenseDropdownMenu";
import { BranchType } from "@/lib/types/models";

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

  return (
    <nav className="flex justify-end w-full px-6 py-2 bg-slate-50">
      <NavigationMenu>
        <NavigationMenuList className="flex">
          <NavigationMenuItem>
            <Link href="/" passHref>
              <Button variant="ghost">หน้าแรก</Button>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/reminder" passHref>
              <Button variant="ghost">เตือนโอน</Button>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavbarExpenseDropdownMenu branches={branches as BranchType[]} />
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/supplier" passHref>
              <Button variant="ghost">รายชื่อบริษัท</Button>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <LogoutButton />
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}
