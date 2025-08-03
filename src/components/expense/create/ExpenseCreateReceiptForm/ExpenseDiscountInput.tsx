import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { Input } from "@/components/ui/input";

export default function ExpenseDiscountSelectInput() {
  const { discountInput, setDiscountInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <Input
      type="number"
      value={discountInput}
      onChange={(e) => setDiscountInput(e.target.value)}
    />
  );
}
