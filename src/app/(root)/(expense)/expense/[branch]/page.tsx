"use client";
import ExpenseTable from "@/components/expense/ExpenseTable";

type BranchExpenseProps = {
  params: Promise<{ branch: string }>;
};

export default function BranchExpense({}: BranchExpenseProps) {
  return (
    <div>
      <ExpenseTable />
    </div>
  );
}
