import {
  MessageCircleWarning,
  Banknote,
  Store,
  ClipboardList,
  FilePlus2,
} from "lucide-react";
import Link from "next/link";

const linkStyle =
  "flex flex-col gap-4 items-center py-8 px-12 rounded-lg border-solid border-2 border-slate-800";
const iconStyle = "w-24 h-24";
const textStyle = "text-3xl";

type iconType =
  | "MessageCircleWarning"
  | "Banknote"
  | "Store"
  | "ClipboardList"
  | "FilePlus2";

type CardIconProps = {
  path: string;
  description: string;
  icon: iconType;
};

export default function CardIcon({ path, description, icon }: CardIconProps) {
  function getIcon(icon: iconType) {
    switch (icon) {
      case "MessageCircleWarning":
        return <MessageCircleWarning strokeWidth={1} className={iconStyle} />;
      case "Banknote":
        return <Banknote strokeWidth={1} className={iconStyle} />;
      case "Store":
        return <Store strokeWidth={1} className={iconStyle} />;
      case "ClipboardList":
        return <ClipboardList strokeWidth={1} className={iconStyle} />;
      case "FilePlus2":
        return <FilePlus2 strokeWidth={1} className={iconStyle} />;
    }
  }
  return (
    <Link href={path} className={linkStyle}>
      <>
        {getIcon(icon)}
        <h2 className={textStyle}>{description}</h2>
      </>
    </Link>
  );
}
