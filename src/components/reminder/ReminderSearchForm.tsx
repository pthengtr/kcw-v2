"use client";

import { toast } from "sonner";

import * as z from "zod";

//import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues } from "react-hook-form";

const searchFormFieldLabel = {
  supplier_name: "บริษัท",
  note_id: "เลขที่ใบวางบิล",
  bill_month: "บิลเดือน",
  due_month: "กำหนดชำระเดือน",
};

function getFieldLabel(field: FieldValues) {
  return searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    ? searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    : field.name;
}

const formSchema = z.object({
  supplier_name: z.string(),
  note_id: z.string(),
  bill_month: z.string(),
  due_month: z.string(),
});

type ReminderSearchDefaultType = {
  supplier_name: string;
  note_id: string;
  bill_month: string;
  due_month: string;
};

type ReminderSearchFormProps = {
  defaultValues: ReminderSearchDefaultType;
  update?: boolean;
};

export default function ReminderSearchForm({
  defaultValues,
}: ReminderSearchFormProps) {
  async function searchReminder(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const insertData = {
      supplier_name: formData.get("supplier_name") as string,
      note_id: formData.get("note_id") as string,
      bill_month: formData.get("bill_month") as string,
      due_month: formData.get("due_month") as string,
    };

    //const supabase = createClient();

    console.log(insertData);
    //const query = supabase.from("payment_reminder").select("*");

    // const { data, error } = await query;

    // console.log(data, error);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { supplier_name, note_id, bill_month, due_month } = values;

      const formData = new FormData();
      formData.append("supplier_name", supplier_name);
      formData.append("note_id", note_id);
      formData.append("bill_month", bill_month);
      formData.append("due_month", due_month);

      searchReminder(formData);

      return Promise.resolve({ success: true });
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
      return Promise.resolve({ success: false });
    }
  }
  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      className="flex justify-center items-center gap-4 pxs-12"
      submitLabel="ค้นหา"
    />
  );
}
