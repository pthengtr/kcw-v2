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
  general_entries_month: "วันที่หน้าบิลเดือน",
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
    case "general_entries_month":
      return <MonthPickerInput field={field} includeAllOption={false} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  general_entries_month: z.string(),
});

type ExpenseGeneralSearchFormDefaultType = {
  general_entries_month: string;
};

type ExpenseGeneralSearchFormProps = {
  defaultValues: ExpenseGeneralSearchFormDefaultType;
};

export default function ExpenseGeneralSearchForm({
  defaultValues,
}: ExpenseGeneralSearchFormProps) {
  const { setGeneralEntries, setTotalGeneralEntries } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  async function searchExpenseGeneral(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const searchData = {
      general_entries_month: formData.get("general_entries_month") as string,
    };

    const supabase = createClient();

    console.log(searchData);
    let query = supabase
      .from("expense_general")
      .select("*,  branch(*), payment_method(*), expense_item(*)", {
        count: "exact",
      })
      .order("entry_date", { ascending: false })
      .limit(500);

    const date = new Date(searchData.general_entries_month);
    // 10th of the same month
    const fromDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    ).toLocaleString("en-US");

    // 10th of the next month
    const toDate = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      1
    ).toLocaleString("en-US");

    query = query.gte("entry_date", fromDate).lt("entry_date", toDate);

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setGeneralEntries(data);
    }
    if (count !== null && count !== undefined) setTotalGeneralEntries(count);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { general_entries_month } = values;

    const formData = new FormData();
    formData.append("general_entries_month", general_entries_month);

    await searchExpenseGeneral(formData);
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
