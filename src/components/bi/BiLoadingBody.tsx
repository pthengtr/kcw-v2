"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type BiLoadingBodyProps = {
  loading: boolean;
  children: ReactNode;
  className?: string;
  label?: string;
};

/**
 * Keeps previous BI content visible while a filter/period refetch runs,
 * with a centered spinner overlay (used on all /bi/* report tabs).
 */
export default function BiLoadingBody({
  loading,
  children,
  className,
  label = "กำลังโหลด…",
}: BiLoadingBodyProps) {
  return (
    <div className="relative">
      {loading ? (
        <div
          className="absolute inset-0 z-20 flex items-start justify-center rounded-xl bg-white/70 pt-24 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-md">
            <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
            {label}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "space-y-4 md:space-y-5",
          loading && "pointer-events-none select-none opacity-60",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
