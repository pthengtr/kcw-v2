import { Store } from "lucide-react";
import Link from "next/link";

const linkStyle =
  "flex flex-col gap-4 items-center py-8 px-12 rounded-lg border-solid border-2 border-slate-800 w-80";
const iconStyle = "w-24 h-24";
const textStyle = "text-3xl";

export default function Expense() {
  return (
    <section className="grid grid-cols-4 h-[90vh] justify-items-center items-center">
      <Link href="/expense/all" className={linkStyle}>
        <Store strokeWidth={1} className={iconStyle} />
        <h2 className={textStyle}>ทุกสาขา</h2>
      </Link>
      <Link href="/expense/main" className={linkStyle}>
        <Store strokeWidth={1} className={iconStyle} />
        <h2 className={textStyle}>สำนักงานใหญ่</h2>
      </Link>
      <Link href="/expense/pattana" className={linkStyle}>
        <Store strokeWidth={1} className={iconStyle} />
        <h2 className={textStyle}>สี่แยกพัฒนา</h2>
      </Link>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </section>
  );
}
