import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
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
            <Link href="/" legacyBehavior passHref>
              <NavigationMenuLink className="">หน้าแรก</NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          {/* <NavigationMenuItem>
            <Link href="/product" legacyBehavior passHref>
              <NavigationMenuLink className="">สินค้า</NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/user" legacyBehavior passHref>
              <NavigationMenuLink className="">พนักงาน</NavigationMenuLink>
            </Link>
          </NavigationMenuItem> */}
          <NavigationMenuItem>
            <Link href="/reminder" legacyBehavior passHref>
              <NavigationMenuLink className="">เตือนโอน</NavigationMenuLink>
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
