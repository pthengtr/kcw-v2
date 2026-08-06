"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Menu, PanelLeft } from "lucide-react";

import { BI_REPORTS } from "@/lib/bi/reports";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessPage } from "@/lib/auth/client-permissions";
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
  sales: BI_PAGE_KEYS.sales,
  "sales-compare": BI_PAGE_KEYS.salesCompare,
  customers: BI_PAGE_KEYS.customers,
  products: BI_PAGE_KEYS.products,
  "product-movement": BI_PAGE_KEYS.productMovement,
  expenses: BI_PAGE_KEYS.expenses,
  "cash-flow": BI_PAGE_KEYS.cashflow,
  vat: BI_PAGE_KEYS.vat,
};

function ReportNav({
  pathname,
  reports,
  onNavigate,
  className,
}: {
  pathname: string;
  reports: typeof BI_REPORTS;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="รายงาน BI">
      {reports.map((report) => {
        const active =
          pathname === report.href || pathname.startsWith(`${report.href}/`);
        const content = (
          <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
            <span className="flex w-full items-center gap-2">
              <span className="truncate font-medium">{report.label}</span>
              {!report.available ? (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  เร็วๆ นี้
                </Badge>
              ) : null}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {report.description}
            </span>
          </span>
        );

        if (!report.available) {
          return (
            <div
              key={report.id}
              className="rounded-md px-3 py-2.5 text-muted-foreground opacity-70"
              aria-disabled
            >
              {content}
            </div>
          );
        }

        return (
          <Button
            key={report.id}
            variant={active ? "secondary" : "ghost"}
            className={cn(
              "h-auto justify-start whitespace-normal px-3 py-2.5",
              active && "bg-slate-200/80"
            )}
            asChild
            onClick={onNavigate}
          >
            <Link href={report.href}>{content}</Link>
          </Button>
        );
      })}
    </nav>
  );
}

export default function BiShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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

  const visibleReports = useMemo(() => {
    if (pageKeys == null) return [];
    return BI_REPORTS.filter((report) => {
      const pageKey = REPORT_PAGE_KEYS[report.id];
      if (!pageKey) return false;
      return canAccessPage(pageKeys, pageKey);
    });
  }, [pageKeys]);

  const activeReport =
    visibleReports.find(
      (r) => pathname === r.href || pathname.startsWith(`${r.href}/`)
    ) ?? visibleReports[0];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-slate-100 via-slate-50 to-white">
      <div className="mx-auto flex w-full max-w-7xl gap-0 md:gap-6 md:px-4 md:py-4 lg:px-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-4 rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-start gap-2 px-1">
              <BackButton href="/home" className="shrink-0" />
              <div className="flex min-w-0 items-center gap-2">
                <PanelLeft className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
                <div>
                  <p className="text-sm font-semibold tracking-wide text-slate-900">
                    KCW BI
                  </p>
                  <p className="text-xs text-muted-foreground">รายงานธุรกิจ</p>
                </div>
              </div>
            </div>
            {visibleReports.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                ไม่มีรายงานที่คุณมีสิทธิ์เข้าถึง
              </p>
            ) : (
              <ReportNav pathname={pathname} reports={visibleReports} />
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
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
                  reports={visibleReports}
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
