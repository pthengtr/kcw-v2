import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FieldValues } from "react-hook-form";

const paymentMethods = [
  { value: "เงินสด", label: "เงินสด" },
  { value: "โอนธนาคาร", label: "โอนธนาคาร" },
  { value: "เช็ค", label: "เช็ค" },
];

type PaymentMethodSelectInputProps = {
  field: FieldValues;
};
export function PaymentMethodSelectInput({
  field,
}: PaymentMethodSelectInputProps) {
  return (
    <Select onValueChange={field.onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="เลือกวิธีการชำระ" />
      </SelectTrigger>
      <SelectContent>
        {paymentMethods.map((method) => (
          <SelectItem key={method.value} value={method.value}>
            {method.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
