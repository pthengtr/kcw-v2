"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";
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
  canAccessAdminRbac,
  canAccessAnyBi,
  canAccessPoStatus,
  canAccessStatementSync,
  canAccessTigerPay,
} from "@/lib/auth/client-permissions";
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

function BrandMark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/home"
      onClick={onNavigate}
      className="inline-flex shrink-0 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring"
      aria-label="KCW หน้าแรก"
    >
      <Image
        src="/kcw-logo.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
        priority
      />
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
  const [pageKeys, setPageKeys] = useState<string[] | null>(null);
  const expenseActive = isExpenseActive(pathname);
  const closeSheet = () => setOpen(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPermissions() {
      const res = await fetch("/api/auth/me/permissions", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json();
      if (!cancelled) {
        setPageKeys(json.pageKeys ?? []);
      }
    }
    void loadPermissions();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPrimaryLinks = useMemo(() => {
    if (pageKeys == null) return [];
    return primaryNavLinks.filter((link) => {
      if (link.href.startsWith("/bi")) return canAccessAnyBi(pageKeys);
      return true;
    });
  }, [pageKeys]);

  const linksBeforeExpense = filteredPrimaryLinks.slice(
    0,
    EXPENSE_DROPDOWN_AFTER_INDEX + 1
  );
  const linksAfterExpense = filteredPrimaryLinks.slice(
    EXPENSE_DROPDOWN_AFTER_INDEX + 1
  );
  const showTigerPay = pageKeys ? canAccessTigerPay(pageKeys) : false;
  const showStatementSync = pageKeys ? canAccessStatementSync(pageKeys) : false;
  const showPoStatus = pageKeys ? canAccessPoStatus(pageKeys) : false;
  const showAdminRbac = pageKeys ? canAccessAdminRbac(pageKeys) : false;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Sheet menu through tablet portrait; horizontal links from lg up. */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="เปิดเมนู">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-0 p-0"
            >
              <SheetHeader className="border-b border-slate-200 px-4 py-3 text-left">
                <SheetTitle className="text-base font-semibold">เมนู</SheetTitle>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
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

                <div className="my-2 border-t border-slate-200" />
                <p className="px-3 pb-1 text-xs text-muted-foreground">
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

                <div className="my-2 border-t border-slate-200" />
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
                {showTigerPay ? (
                  <NavLinkButton
                    href="/tiger-pay"
                    label="TigerPay"
                    icon={Menu}
                    active={pathname === "/tiger-pay"}
                    onNavigate={closeSheet}
                  />
                ) : null}
                {showStatementSync ? (
                  <NavLinkButton
                    href="/bank-statement-sync"
                    label="Bank Sync"
                    icon={Menu}
                    active={pathname === "/bank-statement-sync"}
                    onNavigate={closeSheet}
                  />
                ) : null}
                {showPoStatus ? (
                  <NavLinkButton
                    href="/po"
                    label="PO"
                    icon={Menu}
                    active={pathname === "/po" || pathname.startsWith("/po/")}
                    onNavigate={closeSheet}
                  />
                ) : null}
                {showAdminRbac ? (
                  <NavLinkButton
                    href="/admin/rbac"
                    label="RBAC"
                    icon={ShieldCheck}
                    active={pathname === "/admin/rbac"}
                    onNavigate={closeSheet}
                  />
                ) : null}
              </div>

              <div className="border-t border-slate-200 px-2 py-3">
                <LogoutButton />
              </div>
            </SheetContent>
          </Sheet>
          <BrandMark />
        </div>

        <div className="hidden lg:block">
          <BrandMark />
        </div>

        <div className="hidden min-w-0 lg:flex lg:flex-1 lg:items-center lg:justify-end lg:gap-1">
          <NavigationMenu className="max-w-full">
            <NavigationMenuList className="flex flex-nowrap justify-end gap-0.5">
              {linksBeforeExpense.map((link) => (
                <NavigationMenuItem key={link.href}>
                  <NavLinkButton
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={isNavActive(pathname, link)}
                    className="whitespace-nowrap px-2.5"
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
                    className="whitespace-nowrap px-2.5"
                  />
                </NavigationMenuItem>
              ))}
              {showTigerPay ? (
                <NavigationMenuItem>
                  <NavLinkButton
                    href="/tiger-pay"
                    label="TigerPay"
                    icon={Menu}
                    active={pathname === "/tiger-pay"}
                    className="whitespace-nowrap px-2.5"
                  />
                </NavigationMenuItem>
              ) : null}
              {showStatementSync ? (
                <NavigationMenuItem>
                  <NavLinkButton
                    href="/bank-statement-sync"
                    label="Bank Sync"
                    icon={Menu}
                    active={pathname === "/bank-statement-sync"}
                    className="whitespace-nowrap px-2.5"
                  />
                </NavigationMenuItem>
              ) : null}
              {showPoStatus ? (
                <NavigationMenuItem>
                  <NavLinkButton
                    href="/po"
                    label="PO"
                    icon={Menu}
                    active={pathname === "/po" || pathname.startsWith("/po/")}
                    className="whitespace-nowrap px-2.5"
                  />
                </NavigationMenuItem>
              ) : null}
              {showAdminRbac ? (
                <NavigationMenuItem>
                  <NavLinkButton
                    href="/admin/rbac"
                    label="RBAC"
                    icon={ShieldCheck}
                    active={pathname === "/admin/rbac"}
                    className="whitespace-nowrap px-2.5"
                  />
                </NavigationMenuItem>
              ) : null}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="ml-1 shrink-0 border-l border-slate-200 pl-1">
            <LogoutButton />
          </div>
        </div>

        <div className="ml-auto lg:hidden">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
