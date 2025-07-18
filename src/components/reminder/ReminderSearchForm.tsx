"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues } from "react-hook-form";
import { useContext } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";

const searchFormFieldLabel = {
  supplier_name: "บริษัท",
  note_id: "เลขที่ใบวางบิล",
  due_month: "กำหนดชำระเดือน",
  payment_month: "ชำระแล้วเดือน",
};

function getFieldLabel(field: FieldValues) {
  return searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    ? searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    : field.name;
}

const formSchema = z.object({
  supplier_name: z.string(),
  note_id: z.string(),
  due_month: z.string(),
  payment_month: z.string(),
});

type ReminderSearchDefaultType = {
  supplier_name: string;
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
    try {
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

      return Promise.resolve({ success: true });
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
      return Promise.resolve({ success: false });
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { supplier_name, note_id, due_month, payment_month } = values;

      const formData = new FormData();
      formData.append("supplier_name", supplier_name);
      formData.append("note_id", note_id);
      formData.append("due_month", due_month);
      formData.append("payment_month", payment_month);

      await new Promise(() => searchReminder(formData));

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
