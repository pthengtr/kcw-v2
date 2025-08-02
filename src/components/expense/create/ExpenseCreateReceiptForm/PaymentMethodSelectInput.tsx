import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useId, useState } from "react";
import { FieldValues } from "react-hook-form";

type PaymentMethodType = {
  payment_id: number;
  payment_description: string;
};

type PaymentMethodSelectInputProps = {
  field: FieldValues;
};
export function PaymentMethodSelectInput({
  field,
}: PaymentMethodSelectInputProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([]);

  const supabase = createClient();

  const id = useId();

  const getPaymentmethod = useCallback(
    async function () {
      const query = supabase
        .from("payment_method")
        .select("*")
        .order("payment_id", { ascending: false })
        .limit(500);

      const { data, error } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setPaymentMethods(data);
      }
    },
    [supabase]
  );

  useEffect(() => {
    getPaymentmethod();
  }, [getPaymentmethod]);

  return (
    <Select onValueChange={field.onChange}>
      <SelectTrigger className="">
        <SelectValue placeholder="เลือกวิธีการชำระ" />
      </SelectTrigger>
      <SelectContent>
        {paymentMethods.map((method) => (
          <SelectItem
            key={`${id}-${method.payment_id}`}
            value={method.payment_id.toString()}
          >
            {method.payment_description}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
