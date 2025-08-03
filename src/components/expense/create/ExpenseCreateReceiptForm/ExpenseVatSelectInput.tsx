import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

export default function ExpenseVatSelectInput() {
  const { vatInput, setVatInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <Select value={vatInput} onValueChange={setVatInput}>
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
