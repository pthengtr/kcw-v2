import { useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import ExpenseCreateReceiptForm, {
  expenseCreateReceiptFormDefaultValues,
} from "./ExpenseCreateReceiptForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ExpenseCreateReceiptFormTabProps = {
  update?: boolean;
};

export default function ExpenseCreateReceiptFormCard({
  update = false,
}: ExpenseCreateReceiptFormTabProps) {
  const { selectedReceipt, formExpenseReceipt } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

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
  }, [formExpenseReceipt, selectedReceipt, update]);

  const defaultValues = expenseCreateReceiptFormDefaultValues;

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
