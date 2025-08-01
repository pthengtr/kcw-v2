"use client";
import dynamic from "next/dynamic";

const ExpenseCreatePage = dynamic(
  () => import("@/components/expense/create/ExpenseCreatePage"),
  {
    ssr: false, // ⛔ disables server-side rendering
    loading: () => <p>Loading...</p>,
  }
);
export default function Create() {
  return <ExpenseCreatePage />;
}
