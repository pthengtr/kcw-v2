"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues } from "react-hook-form";
import { ReminderDefaultValueType } from "./ReminderColumn";
import { useContext } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";

function getFieldLabel(field: FieldValues) {
  return field.name;
}

const formSchema = z.object({
  supplier_name: z.string().nonempty("กรุณาใส่ชื่อบริษัท"),
  note_id: z.string().nonempty("กรุณาใส่เลขที่ใบวางบิล"),
});

type ReminderFormProps = {
  defaultValues: ReminderDefaultValueType;
  update?: boolean;
};

export default function ReminderForm({
  defaultValues,
  update = false,
}: ReminderFormProps) {
  const { selectedRow } = useContext(ReminderContext) as ReminderContextType;

  async function searchReminder(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const insertData = {
      supplier_name: formData.get("supplier_name") as string,
    };

    const supabase = createClient();

    console.log(insertData);
    const query =
      update && selectedRow
        ? supabase
            .from("payment_reminder")
            .update([insertData])
            .eq("id", selectedRow.id)
            .select()
        : supabase.from("payment_reminder").insert([insertData]).select();

    const { data, error } = await query;

    console.log(data, error);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { supplier_name } = values;

      const formData = new FormData();
      formData.append("supplier_name", supplier_name);

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
    />
  );
}
