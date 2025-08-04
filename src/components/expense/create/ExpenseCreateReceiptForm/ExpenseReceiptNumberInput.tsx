import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { Input } from "@/components/ui/input";

export default function ExpenseReceiptNumberInput() {
  const { receiptNameFormError } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const { receiptNumber, setReceiptNumber } = useContext(
    ExpenseContext
  ) as ExpenseContextType;
  return (
    <div>
      <Input
        value={receiptNumber}
        onChange={(e) => setReceiptNumber(e.target.value)}
      />
      {receiptNameFormError && (
        <div className="text-red-500 text-xs">{receiptNameFormError}</div>
      )}
    </div>
  );
}
