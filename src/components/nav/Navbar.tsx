import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import LogoutButton from "../auth/LogoutButton";

export default function Navbar() {
  return (
    <nav className="flex justify-end w-full px-6 py-2 bg-slate-50">
      <NavigationMenu>
        <NavigationMenuList className="flex gap-4 ">
          <NavigationMenuItem>
            <Link href="/" passHref>
              หน้าแรก
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/reminder" passHref>
              เตือนโอน
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/expense" passHref>
              ค่าใช้จ่าย
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/supplier" passHref>
              รายชื่อบริษัท
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
