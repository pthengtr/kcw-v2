"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import MonthPickerInput from "../common/MonthPickerInput";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";

const searchFormFieldLabel = {
  company_name: "ชื่อร้าน/บริษัท",
  payment_month: "ค่าใช้จ่ายเดือน",
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
    case "payment_month":
      return <MonthPickerInput field={field} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  company_name: z.string(),
  payment_month: z.string(),
});

type ExpenseSearchDefaultType = {
  company_name: string;
  payment_month: string;
};

type ExpenseSearchFormProps = {
  defaultValues: ExpenseSearchDefaultType;
};

export default function ExpenseSearchForm({
  defaultValues,
}: ExpenseSearchFormProps) {
  const { setExpenses, setTotal } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  async function searchExpense(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const searchData = {
      company_name: formData.get("company_name") as string,
      payment_month: formData.get("payment_month") as string,
    };

    const supabase = createClient();

    console.log(searchData);
    let query = supabase
      .from("expense")
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .limit(500);

    if (searchData.company_name)
      query = query.ilike("company_name", `%${searchData.company_name}%`);

    let payment_start;
    let payment_end;
    if (searchData.payment_month !== "all") {
      payment_start = new Date(searchData.payment_month).toLocaleString(
        "en-US"
      );
      payment_end = new Date(searchData.payment_month);
      payment_end.setMonth(payment_end.getMonth() + 1);
      payment_end = payment_end.toLocaleString("en-US");

      query = query
        .gte("payment_date", payment_start)
        .lt("payment_date", payment_end);
    }

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setExpenses(data);
    }
    if (count) setTotal(count);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { company_name, payment_month } = values;

    const formData = new FormData();

    formData.append("company_name", company_name);
    formData.append("payment_month", payment_month);

    await searchExpense(formData);
  }
  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex justify-center items-center gap-4 pxs-12"
      submitLabel={<Search />}
    />
  );
}
