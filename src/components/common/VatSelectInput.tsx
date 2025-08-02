import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldValues } from "react-hook-form";

type VatSelectInputProps = {
  field: FieldValues;
};

export default function VatSelectInput({ field }: VatSelectInputProps) {
  return (
    <Select defaultValue={field.value} onOpenChange={field.onChange}>
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
