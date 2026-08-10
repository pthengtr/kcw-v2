import type { ReactNode } from "react";

/**
 * Minimal shell for LINE LIFF pages.
 * No Navbar / Supabase app chrome — auth is LINE identity via kcw-api webhook.
 */
export default function LiffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-50 antialiased">
      {children}
    </div>
  );
}
