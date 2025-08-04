import { Button } from "@/components/ui/button";
import { FilePenLine, Plus } from "lucide-react";
import { useContext, useState } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function ExpenseCreateReceiptFormSubmit() {
  const { formExpenseReceipt: form } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const [confirmed, setConfirmed] = useState<boolean | "indeterminate">(false);

  const pathName = usePathname();

  const update = pathName.includes("update-receipt");

  return (
    <div className="flex flex-col items-center mt-2 gap-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="confirm"
          checked={confirmed}
          onCheckedChange={setConfirmed}
        />
        <Label htmlFor="confirm">ตรวจสอบข้อมูลแล้ว</Label>
      </div>
      <Button
        form="create-expense-receipt-form"
        disabled={form.formState.isSubmitting || !confirmed}
        className={`${form.formState.isSubmitting && "bg-blue-300"} mt-2`}
        type="submit"
      >
        {update ? <UpdateButtonDescription /> : <CreateButtonDescription />}
        {form.formState.isSubmitting ? "..." : ""}
      </Button>
    </div>
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
