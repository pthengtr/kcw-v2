import { useContext } from "react";
import { FieldValues } from "react-hook-form";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { Input } from "@/components/ui/input";

type DiscountSelectInputProps = {
  field: FieldValues;
};

export default function ExpenseDiscountSelectInput({
  field,
}: DiscountSelectInputProps) {
  const { discountInput, setDiscountInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  function handleOnChange(value: string) {
    field.onChange(value);
    setDiscountInput(value);
  }

  return (
    <Input
      type="number"
      value={discountInput}
      onChange={(e) => handleOnChange(e.target.value)}
    />
  );
}
