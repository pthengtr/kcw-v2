"use client";
import dynamic from "next/dynamic";

const ExpenseSummaryPage = dynamic(
  () => import("@/components/expense/summary/ExpenseSummaryPage"),
  {
    ssr: false, // ⛔ disables server-side rendering
    loading: () => <p>Loading...</p>,
  }
);

export default function Summary() {
  return <ExpenseSummaryPage />;
}
