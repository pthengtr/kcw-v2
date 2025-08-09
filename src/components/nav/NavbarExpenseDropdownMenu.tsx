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
import { Building2, ChartLine, SquareMenu, Users } from "lucide-react";

type NavbarExpenseDropdownMenuProps = { branches: BranchType[] };

export default function NavbarExpenseDropdownMenu({
  branches,
}: NavbarExpenseDropdownMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">ค่าใช้จ่าย</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href="/expense" passHref>
            เมนูหลัก
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/expense/dashboard" passHref>
            <ChartLine />
            ภาพรวม
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Building2 />
            ค่าใช้จ่ายบริษัท
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {branches?.map((branch) => (
                <DropdownMenuItem asChild key={branch.branch_name}>
                  <Link
                    href={`/expense/company/${branch.branch_uuid}`}
                    passHref
                  >
                    {branch.branch_name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link href="/expense/general" passHref>
            <Users />
            ค่าใช้จ่ายทั่วไป
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/expense/item" passHref>
            <SquareMenu />
            ประเภทค่าใช้จ่าย
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
