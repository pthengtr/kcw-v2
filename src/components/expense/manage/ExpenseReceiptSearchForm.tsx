"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "@/components/common/Form";
import { Input } from "@/components/ui/input";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { Search } from "lucide-react";
import MonthPickerInput from "@/components/common/MonthPickerInput";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

const searchFormFieldLabel = {
  receipt_month: "เลือกเดือน",
};

function getFieldLabel(field: FieldValues) {
  return searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    ? searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    //month picker
    case "receipt_month":
      return <MonthPickerInput field={field} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  receipt_month: z.string(),
});

type ExpenseReceiptSearchFormDefaultType = {
  receipt_month: string;
};

type ExpenseReceiptSearchFormProps = {
  defaultValues: ExpenseReceiptSearchFormDefaultType;
};

export default function ExpenseReceiptSearchForm({
  defaultValues,
}: ExpenseReceiptSearchFormProps) {
  const { setExpenseReceipts, setTotalReceipt } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  async function searchReminder(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const searchData = {
      receipt_month: formData.get("receipt_month") as string,
    };

    const supabase = createClient();

    console.log(searchData);
    let query = supabase
      .from("expense_receipt")
      .select("*, supplier(*), branch(*), payment_method(*)", {
        count: "exact",
      })
      .order("receipt_uuid", { ascending: false })
      .limit(500);

    let receipt_start;
    let receipt_end;
    if (searchData.receipt_month !== "all") {
      receipt_start = new Date(searchData.receipt_month).toLocaleString(
        "en-US"
      );
      receipt_end = new Date(searchData.receipt_month);
      receipt_end.setMonth(receipt_end.getMonth() + 1);
      receipt_end = receipt_end.toLocaleString("en-US");

      query = query
        .gte("receipt_date", receipt_start)
        .lt("receipt_date", receipt_end);
    }

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setExpenseReceipts(data);
    }
    if (count !== null && count !== undefined) setTotalReceipt(count);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { receipt_month } = values;

    const formData = new FormData();
    formData.append("receipt_month", receipt_month);

    await searchReminder(formData);
  }
  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex justify-start items-end gap-4 px-12"
      submitLabel={<Search />}
    />
  );
}
