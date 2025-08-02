import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContext } from "react";
import { FieldValues } from "react-hook-form";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

type VatSelectInputProps = {
  field: FieldValues;
};

export default function ExpenseVatSelectInput({ field }: VatSelectInputProps) {
  const { vatInput, setVatInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  function handleOnOpenChange(value: string) {
    field.onChange(value);
    setVatInput(value);
  }

  return (
    <Select value={vatInput} onValueChange={handleOnOpenChange}>
      <SelectTrigger className="">
        <SelectValue placeholder="เลือกภาษี" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">0 %</SelectItem>
        <SelectItem value="7">7 %</SelectItem>
      </SelectContent>
    </Select>
  );
}
