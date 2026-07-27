"use client";

import { useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Menu } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  EXPENSE_DROPDOWN_AFTER_INDEX,
  expenseMobileLinks,
  isExpenseActive,
  isNavActive,
  primaryNavLinks,
} from "./nav-config";

type NavbarClientProps = {
  branches: BranchType[];
};

function BrandMark({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href="/home"
      onClick={onNavigate}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring",
        compact ? "gap-2" : "gap-2.5"
      )}
      aria-label="KCW หน้าแรก"
    >
      <Image
        src="/kcw-logo.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 object-contain"
        priority
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-wide text-slate-900">
          KCW
        </span>
        {!compact ? (
          <span className="truncate text-[11px] text-muted-foreground">
            ระบบงานภายใน
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function NavLinkButton({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      className={cn(
        "justify-start",
        active && "bg-slate-200/80 text-slate-900",
        className
      )}
      asChild
      onClick={onNavigate}
    >
      <Link href={href}>
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}

export default function NavbarClient({ branches }: NavbarClientProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const expenseActive = isExpenseActive(pathname);
  const closeSheet = () => setOpen(false);

  const linksBeforeExpense = primaryNavLinks.slice(
    0,
    EXPENSE_DROPDOWN_AFTER_INDEX + 1
  );
  const linksAfterExpense = primaryNavLinks.slice(
    EXPENSE_DROPDOWN_AFTER_INDEX + 1
  );

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="เปิดเมนู">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-0 p-0"
            >
              <SheetHeader className="border-b border-slate-200/80 px-4 py-4 text-left">
                <SheetTitle className="sr-only">เมนู</SheetTitle>
                <BrandMark onNavigate={closeSheet} />
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  เมนูหลัก
                </p>
                {linksBeforeExpense.map((link) => (
                  <NavLinkButton
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={isNavActive(pathname, link)}
                    onNavigate={closeSheet}
                  />
                ))}

                <p className="mt-3 flex items-center gap-2 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" aria-hidden />
                  ค่าใช้จ่าย
                </p>
                {expenseMobileLinks(branches).map((link) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== "/expense" &&
                      pathname.startsWith(`${link.href}/`));
                  return (
                    <Button
                      key={link.href}
                      variant={active ? "secondary" : "ghost"}
                      className={cn(
                        "h-auto justify-start whitespace-normal py-2 text-left",
                        active && "bg-slate-200/80 text-slate-900"
                      )}
                      asChild
                      onClick={closeSheet}
                    >
                      <Link href={link.href}>{link.label}</Link>
                    </Button>
                  );
                })}

                <div className="mt-3 flex flex-col gap-1">
                  {linksAfterExpense.map((link) => (
                    <NavLinkButton
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      icon={link.icon}
                      active={isNavActive(pathname, link)}
                      onNavigate={closeSheet}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200/80 px-3 py-3">
                <LogoutButton />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="min-w-0 flex-1 md:flex-none">
          <BrandMark compact />
        </div>

        <div className="hidden md:flex md:flex-1 md:items-center md:justify-end md:gap-1">
          <NavigationMenu>
            <NavigationMenuList className="flex flex-wrap justify-end gap-0.5">
              {linksBeforeExpense.map((link) => (
                <NavigationMenuItem key={link.href}>
                  <NavLinkButton
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={isNavActive(pathname, link)}
                  />
                </NavigationMenuItem>
              ))}
              <NavigationMenuItem>
                <NavbarExpenseDropdownMenu
                  branches={branches}
                  active={expenseActive}
                />
              </NavigationMenuItem>
              {linksAfterExpense.map((link) => (
                <NavigationMenuItem key={link.href}>
                  <NavLinkButton
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={isNavActive(pathname, link)}
                  />
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="ml-1 border-l border-slate-200 pl-1">
            <LogoutButton />
          </div>
        </div>

        <div className="md:hidden">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
