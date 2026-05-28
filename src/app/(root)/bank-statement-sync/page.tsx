"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const BankStatementSyncPage = dynamic(
  () => import("@/components/bank/BankStatementSyncPage"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function Page() {
  return <BankStatementSyncPage />;
}

