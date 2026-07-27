"use client";

import { useEffect, useState, type ReactNode } from "react";

type PermissionGateProps = {
  pageKey: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function PermissionGate({
  pageKey,
  children,
  fallback,
}: PermissionGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/auth/me/permissions", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json();
      const pageKeys: string[] = json.pageKeys ?? [];
      const ok = pageKeys.includes("*") || pageKeys.includes(pageKey);
      if (!cancelled) setAllowed(ok);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return (
      fallback ?? (
        <div className="px-4 py-6 text-muted-foreground">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้
        </div>
      )
    );
  }

  return <>{children}</>;
}

