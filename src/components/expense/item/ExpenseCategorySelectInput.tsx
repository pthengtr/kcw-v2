import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContext, useEffect, useId } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { FieldValues } from "react-hook-form";

type ExpenseCategorySelectInputProps = {
  field: FieldValues;
};

export default function ExpenseCategorySelectInput({
  field,
}: ExpenseCategorySelectInputProps) {
  const { getCategory, expenseCategories } = useContext(
    ExpenseContext
  ) as ExpenseContextType;
  const id = useId();

  useEffect(() => {
    getCategory();
  }, [getCategory]);

  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger>
        <SelectValue placeholder="เลือกหมวดค่าใช้จ่าย..." />
      </SelectTrigger>
      <SelectContent>
        {expenseCategories.map((category) => (
          <SelectItem
            key={`${id}-${category.category_id}`}
            value={category.category_id.toString()}
          >
            {category.category_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
