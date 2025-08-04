import { Button } from "@/components/ui/button";
import { FilePenLine, Plus } from "lucide-react";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { usePathname } from "next/navigation";

export default function ExpenseCreateReceiptFormSubmit() {
  const { formExpenseReceipt: form } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const pathName = usePathname();

  const update = pathName.includes("update-receipt");

  return (
    <Button
      form="create-expense-receipt-form"
      disabled={form.formState.isSubmitting}
      className={`${form.formState.isSubmitting && "bg-blue-300"} mt-2`}
      type="submit"
    >
      {update ? <UpdateButtonDescription /> : <CreateButtonDescription />}
      {form.formState.isSubmitting ? "..." : ""}
    </Button>
  );
}

function CreateButtonDescription() {
  return (
    <>
      <Plus />
      <div>สร้างบิล</div>
    </>
  );
}

function UpdateButtonDescription() {
  return (
    <>
      <FilePenLine />
      <div>บันทึก</div>
    </>
  );
}
