"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues } from "react-hook-form";

function getFieldLabel(field: FieldValues) {
  return field.name;
}

const formSchema = z.object({
  supplier_name: z.string().nonempty("กรุณาใส่ชื่อบริษัท"),
  note_id: z.string().nonempty("กรุณาใส่เลขที่ใบวางบิล"),
});

type ReminderSearchDefaultType = {
  supplier_name: string;
  note_id: string;
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
    };

    const supabase = createClient();

    console.log(insertData);
    const query = supabase.from("payment_reminder").select("*");

    const { data, error } = await query;

    console.log(data, error);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { supplier_name, note_id } = values;

      const formData = new FormData();
      formData.append("supplier_name", supplier_name);
      formData.append("note_id", note_id);

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
      className="flex justify-center items-center gap-4"
    />
  );
}
