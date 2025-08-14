import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const linkStyle =
  "flex flex-col gap-4 items-center py-8 px-12 rounded-lg border-2 border-slate-800 w-80";
const iconStyle = "w-24 h-24";
const textStyle = "text-3xl";

type IconName = keyof typeof Icons;

type CardIconProps = {
  href: string;
  label: string;
  icon: IconName;
  strokeWidth?: number;
};

export default function CardIcon({
  href,
  label,
  icon,
  strokeWidth = 1,
}: CardIconProps) {
  const LucideIconComp = Icons[icon] as LucideIcon; // 👈 assert type

  return (
    <Link href={href} className={linkStyle} aria-label={label}>
      <LucideIconComp
        strokeWidth={strokeWidth}
        className={iconStyle}
        aria-hidden
      />
      <h2 className={textStyle}>{label}</h2>
    </Link>
  );
}
