import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContext, useEffect } from "react";
import { FieldValues } from "react-hook-form";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

type ExpenseItemSelectInputProps = { field: FieldValues };
export default function ExpenseItemSelectInput({
  field,
}: ExpenseItemSelectInputProps) {
  const { expenseItems, getItems } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  useEffect(() => {
    getItems();
  }, [getItems]);

  return (
    <Select value={field.value.toString()} onValueChange={field.onChange}>
      <SelectTrigger className="">
        <SelectValue placeholder="" />
      </SelectTrigger>
      <SelectContent>
        {expenseItems.map((item) => (
          <SelectItem key={item.item_id} value={item.item_id.toString()}>
            {item.item_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
