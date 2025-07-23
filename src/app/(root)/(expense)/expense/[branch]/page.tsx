"use client";
import { getMyCookie } from "@/app/(root)/action";
import ExpenseTable, {
  defaultColumnVisibility,
} from "@/components/expense/ExpenseTable";
import { useEffect, useState } from "react";

type BranchExpenseProps = {
  params: Promise<{ branch: string }>;
};

export default function BranchExpense({}: BranchExpenseProps) {
  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getCookieColumnVisibility() {
      const data = await getMyCookie("expenseColumnVisibility");
      if (data) setColumnVisibility(JSON.parse(data));
      else setColumnVisibility(defaultColumnVisibility);
    }

    async function getPaginationPageSize() {
      const data = await getMyCookie("expensePaginationPageSize");
      if (data) setPaginationPageSize(parseInt(data));
      else setPaginationPageSize(10);
    }

    getCookieColumnVisibility();
    getPaginationPageSize();
  }, []);

  return (
    <div>
      {columnVisibility && paginationPageSize && (
        <ExpenseTable
          columnVisibility={columnVisibility}
          paginationPageSize={paginationPageSize}
        />
      )}
    </div>
  );
}
