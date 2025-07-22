"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";
import Form from "../common/Form";
import { FieldValues } from "react-hook-form";

export const expenseFieldLabel = {
  id: "รายการเลขที่",
  created_at: "สร้าง",
  company_name: "ชื่อร้าน/บริษัท",
  invoice_number: "เลขที่ใบกำกับ/ใบแจ้งหนี้",
  receipt_number: "เลขที่ใบเสร็จรับเงิน",
  expense_group: "ประเภทบัญชี",
  detail: "รายละเอียด",
  total_amount: "จำนวนเงิน",
  payment_date: "วันที่ชำระ",
  payment_mode: "วิธีการชำระ",
};

export function getFieldLabel(field: FieldValues) {
  return expenseFieldLabel[field.name as keyof typeof expenseFieldLabel]
    ? expenseFieldLabel[field.name as keyof typeof expenseFieldLabel]
    : field.name;
}

const formSchema = z.object({
  company_name: z.string().nonempty("กรุณาใส่ชื่อร้าน/บริษัท"),
  invoice_number: z.string().nonempty("กรุณาใส่เลขที่ใบกำกับ/ใบแจ้งหนี้"),
  receipt_number: z.string(),
  expense_group: z.string(),
  detail: z.string(),
  total_amount: z.number(),
  payment_date: z.union([z.date().nullable().optional(), z.literal("")]),
  payment_mode: z.string(),
});

export type ExpenseFormDefaultValueType = {
  company_name: string;
  invoice_number: string;
  receipt_number: string;
  expense_group: string;
  detail: string;
  total_amount: number;
  payment_date: Date | null;
  payment_mode: string;
};

export const expenseFormDefaultValue = {
  company_name: "",
  invoice_number: "",
  receipt_number: "",
  expense_group: "",
  detail: "",
  total_amount: 0,
  payment_date: null,
  payment_mode: "",
};

type ExpenseFormProps = {
  defaultValues: ExpenseFormDefaultValueType;
  update?: boolean;
};

export default function ExpenseForm({
  defaultValues,
  update = false,
}: ExpenseFormProps) {
  async function createUpdateExpense(formData: FormData) {
    const supabase = createClient();

    const {
      data: { user },
      error: errorUser,
    } = await supabase.auth.getUser();

    if (!user || errorUser) {
      console.log("No user logged in or error:", errorUser);
      return;
    }

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const insertData = {
      ...(update ? {} : { created_at: new Date().toLocaleString("en-US") }),

      company_name: formData.get("company_name") as string,
      invoice_number: formData.get("invoice_number") as string,
      receipt_number: formData.get("receipt_number") as string,
      expense_group: formData.get("expense_group") as string,
      detail: formData.get("detail") as string,
      total_amount: parseFloat(
        formData.get("total_amount") as string
      ) as number,
      payment_date: formData.get("payment_date") as string,
      payment_mode: formData.get("payment_mode") as string,
      last_modified: new Date().toLocaleString("en-US"),
    };

    console.log(insertData);

    // //update or insert new data
    // const query = supabase.from("expense").insert([insertData]).select();

    // const { data, error } = await query;

    // console.log(data, error);

    // if (error) {
    //   //   setSubmitError(
    //   //     "เกิดข้อผิดพลาด กรุณาตรวจสอบชื่อบริษัทกับเลขที่ใบวางบิลอีกครั้ง"
    //   //   );
    //   toast.error(
    //     "เกิดข้อผิดพลาด กรุณาตรวจสอบชื่อบริษัทกับเลขที่ใบวางบิลอีกครั้ง"
    //   );
    //   return;
    // }

    // if (data) {
    //   // clear error messsage
    //   toast.success(update ? "แก้ไขรายการสำเร็จ" : "สร้างรายการสำเร็จ");
    // }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const {
        company_name,
        invoice_number,
        receipt_number,
        expense_group,
        detail,
        total_amount,
        payment_date,
        payment_mode,
      } = values;

      const formData = new FormData();

      formData.append("company_name", company_name);
      formData.append("invoice_number", invoice_number);
      formData.append("receipt_number", receipt_number);
      formData.append("expense_group", expense_group);
      formData.append("detail", detail);
      formData.append("total_amount", total_amount.toString());
      if (payment_date) {
        formData.append("payment_date", payment_date.toLocaleString("en-US"));
      }
      formData.append("payment_mode", payment_mode);

      await createUpdateExpense(formData);

      return Promise.resolve({ success: true });
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
      return Promise.resolve({ success: false });
    }
  }

  return (
    <>
      <Form
        schema={formSchema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        getFieldLabel={getFieldLabel}
        className={"flex flex-col gap-8 p-10 max-w-3xl"}
        submitLabel="บันทึก"
      />
    </>
  );
}
