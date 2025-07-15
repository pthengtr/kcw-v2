"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues } from "react-hook-form";

export const fieldLabel = {
  id: "รายการเลขที่",
  created_at: "สร้าง",
  supplier_name: "บริษัท",
  note_id: "เลขที่ใบวางบิล",
  bill_count: "จำนวนบิล",
  start_date: "บิลวันที่",
  end_date: "ถีง",
  total_amount: "จำนวนเงิน",
  discount: "ส่วนลด",
  user_id: "พนักงาน",
  due_date: "กำหนดชำระ",
  kbiz_datetime: "แจ้งเตือน KBIZ",
  payment_date: "วันที่ชำระ",
  remark: "หมายเหตุ",
  last_modified: "แก้ไขล่าสุด",
};

function getFieldLabel(field: FieldValues) {
  return fieldLabel[field.name as keyof typeof fieldLabel]
    ? fieldLabel[field.name as keyof typeof fieldLabel]
    : field.name;
}

const formSchema = z.object({
  supplier_name: z.string().nonempty("กรุณาใส่ชื่อบริษัท"),
  note_id: z.string().nonempty("กรุณาใส่เลขที่ใบวางบิล"),
  bill_count: z
    .number({ message: "เฉพาะตัวเลขจำนวนเต็มเท่านั้น" })
    .int({ message: "please input only number" })
    .positive({ message: "please input only number" }),
  start_date: z.date(),
  end_date: z.date(),
  total_amount: z.number(),
  discount: z.number(),
  due_date: z.date(),
  kbiz_datetime: z.date().nullable().optional(),
  payment_date: z.date().nullable().optional(),
  remark: z.string(),
});

export default function CreateReminderForm() {
  async function createReminder(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const insertData = {
      created_at: new Date().toISOString(),
      supplier_name: formData.get("supplier_name") as string,
      note_id: formData.get("note_id") as string,
      bill_count: parseInt(formData.get("bill_count") as string) as number,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      total_amount: parseFloat(
        formData.get("total_amount") as string
      ) as number,
      discount: parseFloat(formData.get("total_amount") as string) as number,
      user_id: "test user",
      due_date: formData.get("due_date") as string,
      kbiz_datetime: formData.get("kbiz_datetime") as string,
      payment_date: formData.get("payment_date") as string,
      remark: formData.get("remark") as string,
      last_modified: new Date().toISOString(),
    };

    console.log(insertData);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("payment_reminder")
      .insert([insertData])
      .select();

    console.log(data, error);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const {
        supplier_name,
        bill_count,
        start_date,
        note_id,
        total_amount,
        discount,
        due_date,
        kbiz_datetime,
        payment_date,
        remark,
      } = values;

      const formData = new FormData();
      formData.append("supplier_name", supplier_name);
      formData.append("note_id", note_id);
      formData.append("bill_count", bill_count.toString());
      formData.append("start_date", start_date.toISOString());
      formData.append("end_date", start_date.toISOString());
      formData.append("total_amount", total_amount.toString());
      formData.append("discount", discount.toString());
      formData.append("due_date", due_date.toISOString());
      if (kbiz_datetime) {
        console.log(kbiz_datetime);
        formData.append("kbiz_datetime", kbiz_datetime.toISOString());
      }
      if (payment_date) {
        formData.append("payment_date", payment_date.toISOString());
      }

      formData.append("remark", remark);

      createReminder(formData);

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
      defaultValues={{
        supplier_name: "",
        note_id: "",
        bill_count: 1,
        start_date: new Date(),
        end_date: new Date(),
        total_amount: 0,
        discount: 0,
        due_date: new Date(),
        kbiz_datetime: null,
        payment_date: null,
        remark: "",
      }}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
    />
  );
}
