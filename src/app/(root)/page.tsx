import Link from "next/link";
import { MessageCircleWarning, Banknote } from "lucide-react";
import CardIconMenu from "@/components/common/CardIconMenu";

export const linkStyle =
  "flex flex-col gap-4 items-center py-8 px-12 rounded-lg border-solid border-2 border-slate-800";
export const iconStyle = "w-24 h-24";
export const textStyle = "text-3xl";

export default function Home() {
  return (
    // <main className="grid grid-cols-4 h-[90vh] justify-items-center items-center">
    <main>
      <CardIconMenu>
        <Link href="/reminder" className={linkStyle}>
          <MessageCircleWarning strokeWidth={1} className={iconStyle} />
          <h2 className={textStyle}>เตือนโอน</h2>
        </Link>
        <Link href="/expense" className={linkStyle}>
          <Banknote strokeWidth={1} className={iconStyle} />
          <h2 className={textStyle}>ค่าใช้จ่าย</h2>
        </Link>
      </CardIconMenu>
    </main>
  );
}
