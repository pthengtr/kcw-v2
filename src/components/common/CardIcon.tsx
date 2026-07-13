import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const linkStyle =
  "flex w-full max-w-80 flex-col items-center gap-3 rounded-lg border-2 border-slate-800 px-6 py-6 sm:w-80 sm:gap-4 sm:px-12 sm:py-8";
const iconStyle = "h-14 w-14 sm:h-24 sm:w-24";
const textStyle = "text-center text-xl sm:text-3xl";

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
  const LucideIconComp = Icons[icon] as LucideIcon;

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
