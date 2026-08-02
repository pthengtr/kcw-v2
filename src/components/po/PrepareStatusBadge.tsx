import { Badge } from "@/components/ui/badge";
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
    <Badge
      variant="outline"
      className={cn(
<<<<<<< Updated upstream
        "whitespace-nowrap shrink-0",
=======
        "w-fit whitespace-nowrap shrink-0",
>>>>>>> Stashed changes
        prepareStatusBadgeClassName(status),
        className
      )}
    >
      {prepareStatusLabel(status)}
    </Badge>
  );
}
