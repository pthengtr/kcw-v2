import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { Input } from "@/components/ui/input";

export default function ExpenseTaxExemptInput() {
  const { taxExemptInput, setTaxExemptInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <Input
      type="number"
      value={taxExemptInput}
      onChange={(e) => setTaxExemptInput(e.target.value)}
    />
  );
}
