"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

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

export default function AppShell({
  branches,
  children,
}: {
  branches: BranchType[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pageKeys = useSidebarPermissions();
  const closeSheet = () => setOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50/70">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <SidebarNav branches={branches} pageKeys={pageKeys} />
        <div className="mt-auto border-t border-slate-200 px-2 py-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 md:hidden">
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

          <div className="ml-auto shrink-0 md:hidden">
            <LogoutButton />
          </div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
