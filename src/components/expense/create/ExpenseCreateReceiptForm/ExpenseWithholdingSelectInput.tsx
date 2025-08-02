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

type WithholdingSelectInputProps = {
  field: FieldValues;
};

export default function ExpenseWithholdingSelectInput({
  field,
}: WithholdingSelectInputProps) {
  const { withholdingInput, setWithholdingInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  function handleOnOpenChange(value: string) {
    field.onChange(value);
    setWithholdingInput(value);
  }

  return (
    <Select value={withholdingInput} onValueChange={handleOnOpenChange}>
      <SelectTrigger className="">
        <SelectValue placeholder="เลือกหัก ณ ที่จ่าย" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">0 %</SelectItem>
        <SelectItem value="1">1 %</SelectItem>
        <SelectItem value="3">3 %</SelectItem>
        <SelectItem value="5">5 %</SelectItem>
      </SelectContent>
    </Select>
  );
}
