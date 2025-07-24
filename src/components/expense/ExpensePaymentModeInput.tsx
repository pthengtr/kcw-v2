import {
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Select,
} from "../ui/select";
import { useId } from "react";
import { FieldValues } from "react-hook-form";

type ExpensePaymentModeInput = { field: FieldValues };

const paymentMode = ["เงินสด", "โอนธนาคาร", "เช็ค"];

export default function ExpensePaymentModeInput({
  field,
}: ExpensePaymentModeInput) {
  const id = useId();
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="เลือกวิธีการชำระ" />
      </SelectTrigger>
      <SelectContent>
        {paymentMode.map((item) => (
          <SelectItem key={`item-${id}-${item}`} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
