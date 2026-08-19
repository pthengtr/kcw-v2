"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Menu, PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { BI_REPORT_GROUPS } from "@/lib/bi/reports";
import type { BiReportNavGroup, BiReportNavItem } from "@/lib/bi/sales-types";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessPage } from "@/lib/auth/client-permissions";
import { usePersistedBoolean } from "@/lib/use-persisted-boolean";
import { cn } from "@/lib/utils";
import BackButton from "@/components/common/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const REPORT_PAGE_KEYS: Record<string, string> = {
  income: BI_PAGE_KEYS.income,
  "income-statement": BI_PAGE_KEYS.incomeStatement,
  sales: BI_PAGE_KEYS.sales,
  "sales-compare": BI_PAGE_KEYS.salesCompare,
  customers: BI_PAGE_KEYS.customers,
  products: BI_PAGE_KEYS.products,
  "product-sales": BI_PAGE_KEYS.productSales,
  "product-movement": BI_PAGE_KEYS.productMovement,
  expenses: BI_PAGE_KEYS.expenses,
  "cash-flow": BI_PAGE_KEYS.cashflow,
  vat: BI_PAGE_KEYS.vat,
};

function ReportLink({
  report,
  pathname,
  onNavigate,
}: {
  report: BiReportNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    pathname === report.href || pathname.startsWith(`${report.href}/`);

  const label = (
    <span className="flex w-full items-center gap-2 text-left">
      <span className="truncate">{report.label}</span>
      {!report.available ? (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          เร็วๆ นี้
        </Badge>
      ) : null}
    </span>
  );

  if (!report.available) {
    return (
      <div
        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground opacity-70"
        aria-disabled
      >
        {label}
      </div>
    );
  }

  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "h-8 w-full justify-start px-3 font-normal",
        active && "bg-slate-200/80 font-medium"
      )}
      asChild
      onClick={onNavigate}
    >
      <Link href={report.href}>{label}</Link>
    </Button>
  );
}

function ReportNav({
  pathname,
  groups,
  onNavigate,
  className,
}: {
  pathname: string;
  groups: BiReportNavGroup[];
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-5", className)} aria-label="รายงาน BI">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-2 border-b border-slate-200/80 px-3 pb-1.5 text-sm font-bold tracking-wide text-slate-900">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.reports.map((report) => (
              <ReportLink
                key={report.id}
                report={report}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function BiShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [navHidden, setNavHidden] = usePersistedBoolean(
    "kcw-bi-sidebar-hidden",
    false
  );
  const [pageKeys, setPageKeys] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPermissions() {
      const res = await fetch("/api/auth/me/permissions", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json();
      if (!cancelled) setPageKeys(json.pageKeys ?? []);
    }
    void loadPermissions();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = useMemo(() => {
    if (pageKeys == null) return [];
    return BI_REPORT_GROUPS.map((group) => ({
      ...group,
      reports: group.reports.filter((report) => {
        const pageKey = REPORT_PAGE_KEYS[report.id];
        if (!pageKey) return false;
        return canAccessPage(pageKeys, pageKey);
      }),
    })).filter((group) => group.reports.length > 0);
  }, [pageKeys]);

  const visibleReports = useMemo(
    () => visibleGroups.flatMap((g) => g.reports),
    [visibleGroups]
  );

  const activeReport =
    visibleReports.find(
      (r) => pathname === r.href || pathname.startsWith(`${r.href}/`)
    ) ?? visibleReports[0];

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <div className="mx-auto flex w-full max-w-7xl gap-0 md:gap-6 md:px-4 md:py-4 lg:px-6">
        <aside
          className={cn(
            "hidden w-56 shrink-0",
            navHidden ? "md:hidden" : "md:block"
          )}
        >
          <div className="sticky top-4 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-start gap-2 px-1">
              <BackButton href="/home" className="shrink-0" />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <PanelLeft className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-wide text-slate-900">
                    KCW BI
                  </p>
                  <p className="text-xs text-muted-foreground">รายงานธุรกิจ</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="ซ่อนรายการรายงาน"
                onClick={() => setNavHidden(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {visibleGroups.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                ไม่มีรายงานที่คุณมีสิทธิ์เข้าถึง
              </p>
            ) : (
              <ReportNav pathname={pathname} groups={visibleGroups} />
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {navHidden ? (
            <div className="mb-3 hidden items-center gap-2 md:flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="แสดงรายการรายงาน"
                onClick={() => setNavHidden(false)}
              >
                <PanelLeftOpen className="mr-2 h-4 w-4" />
                รายงาน
              </Button>
              <p className="truncate text-sm font-medium text-slate-800">
                {activeReport?.label ?? "BI"}
              </p>
            </div>
          ) : null}
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/90 px-3 py-2.5 backdrop-blur md:hidden">
            <BackButton href="/home" />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="เปิดรายการรายงาน"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(20rem,calc(100vw-2rem))]"
              >
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" aria-hidden />
                    รายงาน BI
                  </SheetTitle>
                </SheetHeader>
                <ReportNav
                  pathname={pathname}
                  groups={visibleGroups}
                  className="mt-6"
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {activeReport?.label ?? "BI"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                แตะเมนูเพื่อเปลี่ยนรายงาน
              </p>
            </div>
          </div>

          <div className="px-3 py-4 sm:px-4 md:px-0 md:py-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
