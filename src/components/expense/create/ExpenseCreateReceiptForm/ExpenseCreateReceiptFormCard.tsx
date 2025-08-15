import { useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import ExpenseCreateReceiptForm, {
  expenseCreateCreditNoteFormDefaultValues,
  expenseCreateReceiptFormDefaultValues,
} from "./ExpenseCreateReceiptForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePathname } from "next/navigation";

type ExpenseCreateReceiptFormTabProps = {
  update?: boolean;
};

export default function ExpenseCreateReceiptFormCard({
  update = false,
}: ExpenseCreateReceiptFormTabProps) {
  const { selectedReceipt, formExpenseReceipt, selectedRefReceipt } =
    useContext(ExpenseContext) as ExpenseContextType;

  const pathName = usePathname();

  useEffect(() => {
    if (update && selectedReceipt) {
      formExpenseReceipt.reset({
        supplier_uuid: selectedReceipt.receipt_uuid,
        payment_uuid: selectedReceipt.payment_uuid,
        receipt_number: selectedReceipt.receipt_number,
        receipt_date: new Date(selectedReceipt.receipt_date),
        vat: selectedReceipt.vat.toString(),
        withholding: selectedReceipt.vat.toString(),
        discount: selectedReceipt.vat.toString(),
        remark: selectedReceipt.remark,
      });
    } else {
      formExpenseReceipt.reset(expenseCreateReceiptFormDefaultValues);
    }
  }, [
    formExpenseReceipt,
    pathName,
    selectedReceipt,
    selectedRefReceipt?.receipt_uuid,
    update,
  ]);

  const defaultValues =
    pathName.includes("credit-note") ||
    selectedReceipt?.doc_type === "CREDIT_NOTE"
      ? expenseCreateCreditNoteFormDefaultValues
      : expenseCreateReceiptFormDefaultValues;

  return (
    <Card className="">
      <CardHeader>
        <CardTitle>รายละเอียดหัวบิล</CardTitle>
      </CardHeader>
      <CardContent>
        <ExpenseCreateReceiptForm
          defaultValues={defaultValues}
          update={update}
        />
      </CardContent>
    </Card>
  );
}
