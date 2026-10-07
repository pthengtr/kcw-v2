"use client";

import Link from "next/link";

import LogoutButton from "@/components/auth/LogoutButton";

export default function PortalHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <Link href="/portal" className="text-sm font-semibold tracking-wide text-slate-900">
        KCW
      </Link>
      <LogoutButton />
    </header>
  );
}
