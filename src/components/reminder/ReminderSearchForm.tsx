"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import MonthPickerInput from "../common/MonthPickerInput";

const searchFormFieldLabel = {
  search_supplier_name: "บริษัท",
  note_id: "เลขที่ใบวางบิล",
  due_month: "กำหนดชำระเดือน",
  payment_month: "ชำระแล้วเดือน",
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
    case "due_month":
      return <MonthPickerInput field={field} />;
      break;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  search_supplier_name: z.string(),
  note_id: z.string(),
  due_month: z.string(),
  payment_month: z.string(),
});

type ReminderSearchDefaultType = {
  search_supplier_name: string;
  note_id: string;
  due_month: string;
  payment_month: string;
};

type ReminderSearchFormProps = {
  defaultValues: ReminderSearchDefaultType;
  update?: boolean;
};

export default function ReminderSearchForm({
  defaultValues,
}: ReminderSearchFormProps) {
  const { setReminders, setTotal } = useContext(
    ReminderContext
  ) as ReminderContextType;

  async function searchReminder(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const searchData = {
      supplier_name: formData.get("supplier_name") as string,
      note_id: formData.get("note_id") as string,
      due_month: formData.get("due_month") as string,
      payment_month: formData.get("payment_month") as string,
    };

    const supabase = createClient();

    console.log(searchData);
    let query = supabase
      .from("payment_reminder")
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .limit(500);

    if (searchData.supplier_name)
      query = query.ilike("supplier_name", `%${searchData.supplier_name}%`);

    if (searchData.note_id)
      query = query.ilike("note_id", `%${searchData.note_id}%`);

    let due_start;
    let due_end;
    if (searchData.due_month !== "all") {
      due_start = new Date(searchData.due_month).toLocaleString("en-US");
      due_end = new Date(searchData.due_month);
      due_end.setMonth(due_end.getMonth() + 1);
      due_end = due_end.toLocaleString("en-US");

      query = query.gte("due_date", due_start).lt("due_date", due_end);
    }

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
      setReminders(data);
    }
    if (count) setTotal(count);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { search_supplier_name, note_id, due_month, payment_month } = values;

    const formData = new FormData();
    formData.append("supplier_name", search_supplier_name);
    formData.append("note_id", note_id);
    formData.append("due_month", due_month);
    formData.append("payment_month", payment_month);

    await searchReminder(formData);
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
