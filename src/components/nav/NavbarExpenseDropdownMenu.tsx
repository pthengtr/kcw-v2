"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import Link from "next/link";
import { BranchType } from "@/lib/types/models";
import { Banknote, Building2, ChevronDown, SquareMenu, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type NavbarExpenseDropdownMenuProps = {
  branches: BranchType[];
  active?: boolean;
};

export default function NavbarExpenseDropdownMenu({
  branches,
  active = false,
}: NavbarExpenseDropdownMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          className={cn(
            "whitespace-nowrap px-2.5",
            active && "bg-slate-200/80 text-slate-900"
          )}
        >
          <Banknote className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          ค่าใช้จ่าย
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem asChild>
          <Link href="/expense">เมนูหลัก</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Building2 />
            ค่าใช้จ่ายบริษัท
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {branches?.map((branch) => (
                <DropdownMenuItem asChild key={branch.branch_uuid}>
                  <Link href={`/expense/company/${branch.branch_uuid}`}>
                    {branch.branch_name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link href="/expense/general">
            <Users />
            ค่าใช้จ่ายทั่วไป
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/expense/item">
            <SquareMenu />
            ประเภทค่าใช้จ่าย
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
