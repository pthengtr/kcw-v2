"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TableLoadingState({
  label = "กำลังโหลด…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-24 flex-col items-center justify-center gap-3 py-8 text-slate-700",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-slate-600" aria-hidden />
      <div className="text-sm font-medium tracking-wide">{label}</div>
    </div>
  );
}
