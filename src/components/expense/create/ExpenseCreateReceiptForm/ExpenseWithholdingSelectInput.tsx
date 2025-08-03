import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

export default function ExpenseWithholdingSelectInput() {
  const { withholdingInput, setWithholdingInput } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  return (
    <Select value={withholdingInput} onValueChange={setWithholdingInput}>
      <SelectTrigger className="">
        <SelectValue placeholder="เลือกหัก ณ ที่จ่าย" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">0 %</SelectItem>
        <SelectItem value="1">1 %</SelectItem>
        <SelectItem value="2">2 %</SelectItem>
        <SelectItem value="3">3 %</SelectItem>
        <SelectItem value="5">5 %</SelectItem>
      </SelectContent>
    </Select>
  );
}
