import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useId } from "react";
import { FieldValues } from "react-hook-form";

type MonthPickerInputProps = {
  field: FieldValues;
};

export default function MonthPickerInput({ field }: MonthPickerInputProps) {
  const id = useId();
  const dateNow = new Date();
  dateNow.setDate(1);
  dateNow.setMonth(dateNow.getMonth() + 2);

  return (
    <Select defaultValue="all" onValueChange={field.onChange}>
      <SelectTrigger className="w-32">
        <SelectValue placeholder="เลือกเดือน">
          {field.value === "all"
            ? "ทั้งหมด"
            : new Date(field.value).toLocaleDateString("th-TH", {
                month: "long",
                year: "2-digit",
              })}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem key={`${id}-all`} value={"all"}>
          ทั้งหมด
        </SelectItem>
        {[...Array(12).keys()].map((month) => {
          dateNow.setMonth(dateNow.getMonth() - 1);
          return (
            <SelectItem key={`${id}-${month}`} value={dateNow.toString()}>
              {dateNow.toLocaleDateString("th-TH", {
                month: "long",
                year: "2-digit",
              })}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
