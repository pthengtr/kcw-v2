import Link from "next/link";
import { MessageCircleWarning, Banknote } from "lucide-react";

export default function Home() {
  return (
    <main className="grid grid-cols-4 h-[90vh] justify-items-center items-center">
      <Link
        href="/reminder"
        className="flex flex-col gap-4 items-center bg-blue-600 py-8 px-12 rounded-lg hover:bg-blue-500"
      >
        <MessageCircleWarning
          strokeWidth={1}
          className="w-24 h-24 text-slate-50"
        />
        <h2 className="text-3xl text-slate-50">เตือนโอน</h2>
      </Link>
      <Link
        href="/expense"
        className="flex flex-col gap-4 items-center bg-blue-600 py-8 px-12 rounded-lg"
      >
        <Banknote strokeWidth={1} className="w-24 h-24 text-slate-50" />
        <h2 className="text-3xl text-slate-50">ค่าใช้จ่าย</h2>
      </Link>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </main>
  );
}
