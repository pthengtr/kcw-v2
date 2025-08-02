"use client";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

const ExpenseSummaryPage = dynamic(
  () => import("@/components/expense/summary/ExpenseSummaryPage"),
  {
    ssr: false, // ⛔ disables server-side rendering
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function Summary() {
  return <ExpenseSummaryPage />;
}
