import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { formatPct } from "@/lib/bi/sales-format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SalesKpiCardProps = {
  title: string;
  value: string;
  hint?: string;
  deltaPct?: number | null;
  icon?: ReactNode;
  className?: string;
};

export default function SalesKpiCard({
  title,
  value,
  hint,
  deltaPct,
  icon,
  className,
}: SalesKpiCardProps) {
  const up = deltaPct != null && deltaPct > 0.05;
  const down = deltaPct != null && deltaPct < -0.05;

  return (
    <Card className={cn("border-slate-200/80 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon ? (
          <div className="text-slate-500" aria-hidden>
            {icon}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {value}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {deltaPct != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                up && "text-emerald-700",
                down && "text-rose-700",
                !up && !down && "text-muted-foreground"
              )}
            >
              {up ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : down ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {formatPct(deltaPct)} vs ช่วงก่อน
            </span>
          ) : null}
          {hint ? (
            <span className="text-muted-foreground">{hint}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
