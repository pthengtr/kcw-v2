import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import ExpenseCreateReceiptForm, {
  expenseCreateReceiptFormDefaultValues,
} from "./ExpenseCreateReceiptForm";

type ExpenseCreateReceiptFormTabProps = {
  update?: boolean;
};

export default function ExpenseCreateReceiptFormTab({
  update = false,
}: ExpenseCreateReceiptFormTabProps) {
  const {
    createReceiptTab,
    setCreateReceiptTab,
    setVatInput,
    setWithholdingInput,
    setDiscountInput,
    selectedReceipt,
    formExpenseReceipt,
  } = useContext(ExpenseContext) as ExpenseContextType;

  function handleChangeCreateReceiptTab(value: string) {
    if (value === "individual") {
      setVatInput("0");
      setWithholdingInput("0");
      setDiscountInput("0");
    } else if (value === "company") {
      setVatInput("7");
      setWithholdingInput("0");
    }
    setCreateReceiptTab(value);
  }

  useEffect(() => {
    if (update && selectedReceipt) {
      formExpenseReceipt.reset({
        supplier_uuid: selectedReceipt.receipt_uuid,
        payment_uuid: selectedReceipt.payment_uuid,
        tax_invoice_number: selectedReceipt.tax_invoice_number
          ? selectedReceipt.tax_invoice_number
          : "",
        tax_invoice_date: selectedReceipt.tax_invoice_date
          ? new Date(selectedReceipt.tax_invoice_date)
          : "",
        receipt_number: selectedReceipt.receipt_number
          ? selectedReceipt.receipt_number
          : "",
        receipt_date: selectedReceipt.receipt_date
          ? new Date(selectedReceipt.receipt_date)
          : "",
        invoice_number: selectedReceipt.invoice_number
          ? selectedReceipt.invoice_number
          : "",
        invoice_date: selectedReceipt.invoice_date
          ? new Date(selectedReceipt.invoice_date)
          : "",
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

  // remove for individual
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invoice_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invoice_date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tax_invoice_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tax_invoice_date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    receipt_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    vat,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withholding,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    discount,
    ...noVatDefaultValues
  } = defaultValues;

  return (
    <Tabs
      value={createReceiptTab}
      onValueChange={handleChangeCreateReceiptTab}
      className="w-full h-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="company">บริษัท</TabsTrigger>
        <TabsTrigger value="individual">ทั่วไป</TabsTrigger>
      </TabsList>
      <TabsContent value="company" className="h-full">
        <div className="p-4 border rounded-lg mt-2 overflow-auto">
          <ExpenseCreateReceiptForm
            defaultValues={defaultValues}
            update={update}
          />
        </div>
      </TabsContent>
      <TabsContent value="individual" className="h-full">
        <div className="p-4 border rounded-lg mt-2">
          <ExpenseCreateReceiptForm
            defaultValues={noVatDefaultValues}
            update={update}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
