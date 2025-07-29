"use client";
import ExpenseReceiptDetail from "@/components/expense/summary/ExpenseReceiptDetail";
import ExpenseReceiptTable, {
  defaultExpenseReceiptColumnVisibility,
} from "@/components/expense/summary/ExpenseReceiptTable";

export default function Summary() {
  return (
    <section className="grid grid-cols-2">
      <div className="p-4">
        <ExpenseReceiptTable
          columnVisibility={defaultExpenseReceiptColumnVisibility}
          paginationPageSize={10}
        />
      </div>
      <div className="p-4">
        <ExpenseReceiptDetail />
      </div>
    </section>
  );
}
