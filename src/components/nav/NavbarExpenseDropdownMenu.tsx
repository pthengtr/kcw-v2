"use client";

import { BranchType } from "@/app/(root)/(expense)/expense/page";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import Link from "next/link";

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
        {branches?.map((branch) => (
          <DropdownMenuItem asChild key={branch.branch_name}>
            <Link href={`/expense/${branch.branch_id}`} passHref>
              {branch.branch_name}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/expense/item" passHref>
            ประเภทค่าใช้จ่าย
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
