import ExpenseFormDialog from "./ExpenseFormDialog";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";
import { Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { expenseFormDefaultValue } from "./ExpenseForm";

export default function ExpenseUpdateFormDialog() {
  const { openUpdateDialog, setOpenUpdateDialog, selectedRow } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const row = selectedRow;

  const defaultValues = row
    ? {
        company_name: row.company_name ? row.company_name : "",
        ...(row.invoice_date
          ? { invoice_date: new Date(row.invoice_date) }
          : {}),
        ...(row.invoice_number ? { invoice_number: row.invoice_number } : {}),
        ...(row.receipt_number ? { receipt_number: row.receipt_number } : {}),
        expense_group: row.expense_group,
        detail: row.detail,
        total_amount: Math.round(row.total_amount * 100) / 100,
        payment_date: new Date(row.payment_date),
        payment_mode: row.payment_mode ? row.payment_mode : "",
        remark: row.remark ? row.remark : "",
        receipt_pictures: [],
        agree: false,
      }
    : expenseFormDefaultValue;

  return (
    <>
      {row && (
        <ExpenseFormDialog
          open={openUpdateDialog}
          setOpen={setOpenUpdateDialog}
          dialogTrigger={
            <Button id={`update-expense-${row.id}`}>
              <Pencil />
            </Button>
          }
          dialogHeader={`เพิ่มรายการค่าใช้จ่าย`}
          defaultValues={defaultValues}
          update
        />
      )}
    </>
  );
}
