import Link from "next/link";
import { ArrowBigLeftDash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  href: string;
  label?: string;
  className?: string;
};

/** Shared “กลับ” control — prefer explicit href over history.back(). */
export default function BackButton({
  href,
  label = "กลับ",
  className,
}: BackButtonProps) {
  return (
    <Button variant="outline" className={cn(className)} asChild>
      <Link href={href}>
        <ArrowBigLeftDash strokeWidth={1} />
        {label}
      </Link>
    </Button>
  );
}
