import { useContext } from "react";
import ExpenseCreateReceiptFormSubmit from "./ExpenseCreateReceiptForm/ExpenseCreateReceiptFormSubmit";
import ExpenseCommonReceiptSummary from "../ExpenseCommonReceiptSummary";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

export default function ExpenseCreateReceiptSummary() {
  const {
    createEntries,
    vatInput,
    discountInput,
    withholdingInput,
    taxExemptInput,
  } = useContext(ExpenseContext) as ExpenseContextType;

  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
      <ExpenseCommonReceiptSummary
        entries={createEntries}
        vatInput={parseInt(vatInput)}
        discountInput={parseFloat(discountInput)}
        withholdingInput={parseInt(withholdingInput)}
        taxExemptInput={parseFloat(taxExemptInput)}
      />

      <div className="justify-self-center sm:col-span-2">
        <ExpenseCreateReceiptFormSubmit />
      </div>
    </div>
  );
}
