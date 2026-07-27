import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Handshake,
  MessageCircleWarning,
} from "lucide-react";
import { BranchType } from "@/lib/types/models";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match nested routes under this prefix (e.g. /bi → /bi/income). */
  matchPrefix?: string;
};

/**
 * Primary links shown beside the expense dropdown.
 *
 * Recommended order (daily ops → finance → master data → analytics):
 * 1. เตือนโอน
 * 2. ค่าใช้จ่าย (dropdown — rendered separately)
 * 3. รายชื่อคู่ค้า
 * 4. BI
 *
 * Home is reached via the brand mark, not a duplicate text link.
 */
export const primaryNavLinks: NavLink[] = [
  {
    href: "/reminder",
    label: "เตือนโอน",
    icon: MessageCircleWarning,
    matchPrefix: "/reminder",
  },
  {
    href: "/party",
    label: "รายชื่อคู่ค้า",
    icon: Handshake,
    matchPrefix: "/party",
  },
  {
    href: "/bi/income",
    label: "BI",
    icon: BarChart3,
    matchPrefix: "/bi",
  },
];

/** Insert expense dropdown after the first primary link (เตือนโอน). */
export const EXPENSE_DROPDOWN_AFTER_INDEX = 0;

export function isNavActive(pathname: string, link: NavLink) {
  const prefix = link.matchPrefix ?? link.href;
  return (
    pathname === link.href ||
    pathname === prefix ||
    pathname.startsWith(`${prefix}/`)
  );
}

export function isExpenseActive(pathname: string) {
  return pathname === "/expense" || pathname.startsWith("/expense/");
}

export function expenseMobileLinks(branches: BranchType[]) {
  return [
    { href: "/expense", label: "เมนูหลัก" },
    ...branches.map((branch) => ({
      href: `/expense/company/${branch.branch_uuid}`,
      label: `ค่าใช้จ่ายบริษัท · ${branch.branch_name}`,
    })),
    { href: "/expense/general", label: "ค่าใช้จ่ายทั่วไป" },
    { href: "/expense/item", label: "ประเภทค่าใช้จ่าย" },
  ];
}
