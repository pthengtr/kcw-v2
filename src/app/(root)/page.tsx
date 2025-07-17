"use client";

import Link from "next/link";
import { MessageCircleWarning, PackageSearch, BookUser } from "lucide-react";

export default function Home() {
  return (
    <main className="grid grid-cols-3 h-full justify-items-center items-center">
      <Link
        href="/reminder"
        className="flex flex-col gap-4 items-center bg-blue-600 py-8 px-12 rounded-lg hover:bg-blue-500"
      >
        <MessageCircleWarning
          strokeWidth={1}
          className="w-36 h-36 text-slate-50"
        />
        <h2 className="text-3xl text-slate-50">เตือนโอน</h2>
      </Link>
      <div className="flex flex-col gap-4 items-center bg-blue-600 py-8 px-12 rounded-lg">
        <PackageSearch strokeWidth={1} className="w-36 h-36 text-slate-50" />
        <h2 className="text-3xl text-slate-50">สินค้า</h2>
      </div>
      <div className="flex flex-col gap-4 items-center bg-blue-600 py-8 px-12 rounded-lg ">
        <BookUser strokeWidth={1} className="w-36 h-36 text-slate-50" />
        <h2 className="text-3xl text-slate-50">ลูกค้า</h2>
      </div>
    </main>
  );
}
