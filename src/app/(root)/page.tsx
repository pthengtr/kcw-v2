import Link from "next/link";
import { MessageCircleWarning, Banknote } from "lucide-react";
import CardIconMenu from "@/components/common/CardIconMenu";
import { iconStyle, linkStyle, textStyle } from "@/lib/utils";

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
