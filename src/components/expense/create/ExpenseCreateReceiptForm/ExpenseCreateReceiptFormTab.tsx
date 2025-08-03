import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import ExpenseCreateReceiptForm, {
  expenseCreateReceiptFormDefaultValues,
} from "./ExpenseCreateReceiptForm";

export default function ExpenseCreateReceiptFormTab() {
  const {
    createReceiptTab,
    setCreateReceiptTab,
    setVatInput,
    setWithholdingInput,
    setDiscountInput,
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
  } = expenseCreateReceiptFormDefaultValues;

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
            defaultValues={expenseCreateReceiptFormDefaultValues}
          />
        </div>
      </TabsContent>
      <TabsContent value="individual" className="h-full">
        <div className="p-4 border rounded-lg mt-2">
          <ExpenseCreateReceiptForm defaultValues={noVatDefaultValues} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
