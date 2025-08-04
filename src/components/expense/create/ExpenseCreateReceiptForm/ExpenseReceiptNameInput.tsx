import { useContext } from "react";
import { Input } from "../../../ui/input";
import { FieldValues } from "react-hook-form";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

type ExpenseReceiptNameInputProps = {
  field: FieldValues;
};

export default function ExpenseReceiptNameInput({
  field,
}: ExpenseReceiptNameInputProps) {
  const { receiptNameFormError } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <div>
      <Input type="text" {...field} />
      {receiptNameFormError && (
        <div className="text-red-500 text-xs">{receiptNameFormError}</div>
      )}
    </div>
  );
}
