import ExpenseEntryTable, {
  defaultReceiptEntryColumnVisibility,
} from "./ExpenseEntryTable";

export default function ExpenseSummaryDetail() {
  return (
    <>
      <ExpenseEntryTable
        columnVisibility={defaultReceiptEntryColumnVisibility}
        paginationPageSize={10}
      />
    </>
  );
}
