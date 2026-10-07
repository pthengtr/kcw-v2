"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const BankStatementSyncPage = dynamic(
  () => import("@/components/bank/BankStatementSyncPage"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function Page() {
  return <BankStatementSyncPage readOnly backHref="/portal" />;
}
