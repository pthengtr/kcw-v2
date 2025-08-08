"use client";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

const ExpenseUpdatePage = dynamic(
  () => import("@/components/expense/update-receipt/ExpenseUpdatePage"),
  {
    ssr: false, // ⛔ disables server-side rendering
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);
export default function Update() {
  return <ExpenseUpdatePage />;
}
