import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useContext, useEffect, useId, useState } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

type PaymentMethodType = {
  payment_id: number;
  payment_description: string;
};

export default function ExpensePaymentMethodSelectInput() {
  const { setSelectedPaymentMethod } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

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

  const sortedPaymentmethod = paymentMethods.sort((a, b) =>
    a.payment_description.localeCompare(b.payment_description)
  );

  function handleValueChanage(payment_id: string) {
    setSelectedPaymentMethod(
      paymentMethods.find(
        (method) => method.payment_id === parseInt(payment_id)
      )
    );
  }

  return (
    <Select onValueChange={(value) => handleValueChanage(value)}>
      <SelectTrigger className="">
        <SelectValue placeholder="เลือกวิธีการชำระ" />
      </SelectTrigger>
      <SelectContent>
        {sortedPaymentmethod.map((method, index) => (
          <SelectItem
            key={`${id}-${index}`}
            value={method.payment_id.toString()}
          >
            {method.payment_description}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
