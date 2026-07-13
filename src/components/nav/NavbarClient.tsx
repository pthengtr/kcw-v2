"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "../ui/button";
import LogoutButton from "../auth/LogoutButton";
import NavbarExpenseDropdownMenu from "./NavbarExpenseDropdownMenu";
import { BranchType } from "@/lib/types/models";

type NavbarClientProps = {
  branches: BranchType[];
};

const navLinks = [
  { href: "/home", label: "หน้าแรก" },
  { href: "/reminder", label: "เตือนโอน" },
  { href: "/party", label: "รายชื่อคู่ค้า" },
];

const expenseLinks = (branches: BranchType[]) => [
  { href: "/expense", label: "เมนูหลัก" },
  { href: "/expense/dashboard", label: "ภาพรวม" },
  ...branches.map((branch) => ({
    href: `/expense/company/${branch.branch_uuid}`,
    label: `ค่าใช้จ่ายบริษัท · ${branch.branch_name}`,
  })),
  { href: "/expense/general", label: "ค่าใช้จ่ายทั่วไป" },
  { href: "/expense/item", label: "ประเภทค่าใช้จ่าย" },
];

export default function NavbarClient({ branches }: NavbarClientProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-2 sm:px-6">
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="เปิดเมนู">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))]">
            <SheetHeader>
              <SheetTitle>เมนู</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => setOpen(false)}
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}

              <p className="mt-3 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ค่าใช้จ่าย
              </p>
              {expenseLinks(branches).map((link) => (
                <Button
                  key={link.href}
                  variant="ghost"
                  className="justify-start text-left whitespace-normal h-auto py-2"
                  asChild
                  onClick={() => setOpen(false)}
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}

              <div className="mt-4 border-t pt-4">
                <LogoutButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:flex md:flex-1 md:justify-end">
        <NavigationMenu>
          <NavigationMenuList className="flex flex-wrap justify-end">
            {navLinks.map((link) => (
              <NavigationMenuItem key={link.href}>
                <Link href={link.href} passHref>
                  <Button variant="ghost">{link.label}</Button>
                </Link>
              </NavigationMenuItem>
            ))}
            <NavigationMenuItem>
              <NavbarExpenseDropdownMenu branches={branches} />
            </NavigationMenuItem>
            <NavigationMenuItem>
              <LogoutButton />
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </nav>
  );
}
