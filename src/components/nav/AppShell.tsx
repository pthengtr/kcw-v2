"use client";

import { useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import LogoutButton from "@/components/auth/LogoutButton";
import { SidebarNav, useSidebarPermissions } from "@/components/nav/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BranchType } from "@/lib/types/models";
import { usePersistedBoolean } from "@/lib/use-persisted-boolean";
import { cn } from "@/lib/utils";

export default function AppShell({
  branches,
  children,
}: {
  branches: BranchType[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [navHidden, setNavHidden] = usePersistedBoolean(
    "kcw-app-sidebar-hidden",
    false
  );
  const pageKeys = useSidebarPermissions();
  const closeSheet = () => setOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50/70">
      <aside
        className={cn(
          "hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex-col",
          navHidden ? "md:hidden" : "md:flex"
        )}
      >
        <SidebarNav
          branches={branches}
          pageKeys={pageKeys}
          headerAction={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="ซ่อนเมนู"
              onClick={() => setNavHidden(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          }
        />
        <div className="mt-auto border-t border-slate-200 px-2 py-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3",
            navHidden ? "flex" : "md:hidden"
          )}
        >
          <div className="md:hidden">
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
                <SheetHeader className="sr-only">
                  <SheetTitle>เมนู</SheetTitle>
                </SheetHeader>
                <SidebarNav
                  branches={branches}
                  pageKeys={pageKeys}
                  onNavigate={closeSheet}
                  className="flex-1"
                />
                <div className="border-t border-slate-200 px-2 py-3">
                  <LogoutButton />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="แสดงเมนู"
            onClick={() => setNavHidden(false)}
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>

          <div className="ml-auto shrink-0">
            <LogoutButton />
          </div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
