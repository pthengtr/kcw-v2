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
  voucher_month: " ",
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
    case "voucher_month":
      return <MonthPickerInput field={field} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  voucher_month: z.string(),
});

type ExpenseVoucherSearchFormDefaultType = {
  voucher_month: string;
};

type ExpenseVoucherSearchFormProps = {
  defaultValues: ExpenseVoucherSearchFormDefaultType;
};

export default function ExpenseVoucherSearchForm({
  defaultValues,
}: ExpenseVoucherSearchFormProps) {
  const { setExpenseVouchers, setTotalVouchers } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  async function searchVoucher(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const searchData = {
      voucher_month: formData.get("voucher_month") as string,
    };

    const supabase = createClient();

    let query = supabase
      .from("expense_receipt")
      .select("*", {
        count: "exact",
      })
      .order("receipt_date", { ascending: true })
      .limit(500);

    const date = new Date(searchData.voucher_month);
    // 10th of the same month
    const fromDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      10
    ).toLocaleString("en-US");

    // 10th of the next month
    const toDate = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      10
    ).toLocaleString("en-US");

    query = query.gte("created_at", fromDate).lt("created_at", toDate);

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setExpenseVouchers(data);
    }
    if (count) setTotalVouchers(count);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { voucher_month } = values;

    const formData = new FormData();
    formData.append("voucher_month", voucher_month);

    await searchVoucher(formData);
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
