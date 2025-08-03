import { useContext } from "react";
import ExpenseCreateReceiptFormSubmit from "./ExpenseCreateReceiptForm/ExpenseCreateReceiptFormSubmit";
import ExpenseCommonReceiptSummary from "../ExpenseCommonReceiptSummary";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

export default function ExpenseCreateReceiptSummary() {
  const { createEntries, vatInput, discountInput, withholdingInput } =
    useContext(ExpenseContext) as ExpenseContextType;

  return (
    <div className="grid grid-cols-2 gap-2">
      <ExpenseCommonReceiptSummary
        entries={createEntries}
        vatInput={parseInt(vatInput)}
        discountInput={parseFloat(discountInput)}
        withholdingInput={parseInt(withholdingInput)}
      />

      <div className="col-span-2 justify-self-center">
        <ExpenseCreateReceiptFormSubmit />
      </div>
    </div>
  );
}
