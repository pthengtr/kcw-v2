import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

export default function ExpenseCreateReceiptFormSubmit() {
  const { formExpenseReceipt: form } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <Button
      form="create-expense-receipt-form"
      disabled={form.formState.isSubmitting}
      className={`${form.formState.isSubmitting && "bg-blue-300"} mt-2`}
      type="submit"
    >
      <Plus />
      <div>สร้างบิล</div>
      {form.formState.isSubmitting ? "..." : ""}
    </Button>
  );
}
