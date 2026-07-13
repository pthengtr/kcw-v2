"use client";

import {
  CheckCircle2,
  Circle,
  Clock3,
  Coins,
  ScanSearch,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTigerPayStatusPresentation } from "@/lib/bank/tiger-pay-format";

const iconMap = {
  check: CheckCircle2,
  clock: Clock3,
  review: ScanSearch,
  coins: Coins,
  x: XCircle,
  circle: Circle,
} as const;

const toneClass: Record<
  ReturnType<typeof getTigerPayStatusPresentation>["tone"],
  string
> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  pending: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  cancelled: "",
  unknown: "",
};

export function TigerPayStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const presentation = getTigerPayStatusPresentation(status);
  const Icon = iconMap[presentation.icon];

  return (
    <Badge
      variant={presentation.variant}
      className={cn(
        "gap-1 font-medium max-w-full whitespace-normal text-left",
        toneClass[presentation.tone],
        className
      )}
      title={status ?? undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="break-words">{presentation.label}</span>
      <span className="sr-only">({status ?? "unknown"})</span>
    </Badge>
  );
}
