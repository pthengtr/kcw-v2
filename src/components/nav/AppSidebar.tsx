"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Home,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { expenseMobileLinks } from "@/components/nav/nav-config";
import {
  canAccessAdminRbac,
  filterHomeMenuItem,
  matchesMenuSearch,
} from "@/lib/home/sidebar-menu";
import {
  HOME_MENU_GROUPS,
  HOME_MENU_ITEMS,
  type HomeMenuItem,
} from "@/lib/home/menu";
import { BranchType } from "@/lib/types/models";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  branches: BranchType[];
  pageKeys: string[] | null;
  onNavigate?: () => void;
  className?: string;
};

function isPathActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/home" && pathname.startsWith(`${href}/`))
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "h-8 w-full justify-start gap-2 px-2.5 font-normal",
        active && "bg-slate-200/80 font-medium text-slate-900"
      )}
      asChild
      onClick={onNavigate}
    >
      <Link href={href}>
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  );
}

function MenuItemLink({
  item,
  pathname,
  onNavigate,
}: {
  item: HomeMenuItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isPathActive(pathname, item.href);

  return (
    <SidebarLink
      href={item.href}
      label={item.label}
      icon={Icon}
      active={active}
      onNavigate={onNavigate}
    />
  );
}

function MenuDivider() {
  return <div className="my-2 border-t border-slate-200" role="separator" />;
}

export function SidebarNav({
  branches,
  pageKeys,
  onNavigate,
  className,
}: SidebarNavProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(
    () => pathname === "/expense" || pathname.startsWith("/expense/")
  );
  const ExpenseIcon = HOME_MENU_ITEMS.expense.icon;
  const searching = Boolean(query.trim());

  const expenseLinks = useMemo(
    () => expenseMobileLinks(branches),
    [branches]
  );

  const filteredGroups = useMemo(() => {
    if (pageKeys == null) return [];

    return HOME_MENU_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!filterHomeMenuItem(item, pageKeys)) return false;
        return matchesMenuSearch(item, query);
      }),
    })).filter((group) => group.items.length > 0);
  }, [pageKeys, query]);

  const filteredExpenseLinks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return expenseLinks;
    return expenseLinks.filter((link) =>
      link.label.toLowerCase().includes(normalized)
    );
  }, [expenseLinks, query]);

  const showExpenseSection =
    pageKeys != null &&
    (filteredExpenseLinks.length > 0 ||
      (!searching &&
        matchesMenuSearch(
          {
            label: HOME_MENU_ITEMS.expense.label,
            description: HOME_MENU_ITEMS.expense.description,
          },
          query
        )));

  const showAdminRbac = pageKeys ? canAccessAdminRbac(pageKeys) : false;
  const homeActive = pathname === "/home";
  const expenseActive =
    pathname === "/expense" || pathname.startsWith("/expense/");

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-b border-slate-200 px-3 py-3">
        <Link
          href="/home"
          onClick={onNavigate}
          className="mb-3 inline-flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="KCW หน้าแรก"
        >
          <Image
            src="/kcw-logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="text-sm font-semibold text-slate-900">KCW v.2</span>
        </Link>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาเมนู..."
            className="h-8 bg-white pl-8 pr-8 text-sm"
            aria-label="ค้นหาเมนู"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="ล้างการค้นหา"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        aria-label="เมนูหลัก"
      >
        <div className="flex flex-col gap-0.5">
          {!searching ? (
            <SidebarLink
              href="/home"
              label="หน้าแรก"
              icon={Home}
              active={homeActive}
              onNavigate={onNavigate}
            />
          ) : null}

          {showExpenseSection ? (
            <>
              {!searching ? (
                <Button
                  type="button"
                  variant={expenseActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 w-full justify-between gap-2 px-2.5 font-normal",
                    expenseActive && "bg-slate-200/80 font-medium text-slate-900"
                  )}
                  onClick={() => setExpenseOpen((open) => !open)}
                  aria-expanded={expenseOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ExpenseIcon
                      className="h-4 w-4 shrink-0 opacity-80"
                      aria-hidden
                    />
                    <span className="truncate text-sm">
                      {HOME_MENU_ITEMS.expense.label}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      expenseOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </Button>
              ) : null}
              {(searching || expenseOpen) &&
                filteredExpenseLinks.map((link) => (
                  <SidebarLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={isPathActive(pathname, link.href)}
                    onNavigate={onNavigate}
                  />
                ))}
            </>
          ) : null}

          {filteredGroups.map((group) => {
            const originalIndex = HOME_MENU_GROUPS.findIndex(
              (candidate) => candidate.title === group.title
            );
            return (
              <div key={group.title} className="contents">
                {!searching && originalIndex > 0 ? <MenuDivider /> : null}
                {group.items.map((item) => (
                  <MenuItemLink
                    key={item.key}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            );
          })}

          {showAdminRbac ? (
            <>
              {!searching ? <MenuDivider /> : null}
              <SidebarLink
                href="/admin/rbac"
                label="RBAC"
                icon={ShieldCheck}
                active={pathname === "/admin/rbac"}
                onNavigate={onNavigate}
              />
            </>
          ) : null}
        </div>

        {searching &&
        filteredGroups.every((group) => group.items.length === 0) &&
        filteredExpenseLinks.length === 0 ? (
          <p className="px-2.5 py-4 text-center text-sm text-slate-400">
            ไม่พบเมนูที่ตรงกับ &ldquo;{query.trim()}&rdquo;
          </p>
        ) : null}
      </nav>
    </div>
  );
}

export function useSidebarPermissions() {
  const [pageKeys, setPageKeys] = useState<string[] | null>(null);

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

  return pageKeys;
}
