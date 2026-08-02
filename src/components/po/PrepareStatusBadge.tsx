import { badgeVariants } from "@/components/ui/badge";
import {
  prepareStatusBadgeClassName,
  prepareStatusLabel,
  type PoPrepareStatus,
} from "@/lib/po/format";
import { cn } from "@/lib/utils";

export default function PrepareStatusBadge({
  status,
  className,
}: {
  status: PoPrepareStatus | string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: "outline" }),
        "inline-flex w-max max-w-max whitespace-nowrap",
        prepareStatusBadgeClassName(status),
        className
      )}
    >
      {prepareStatusLabel(status)}
    </span>
  );
}
