"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";
import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { Input } from "../ui/input";
import { DatePickerInput } from "../common/DatePickerInput";
import ImageDropableForm from "../common/ImageDropableForm";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { useParams } from "next/navigation";

export const branchLabel = {
  all: "ทั้งหมด",
  main: "สาขาสำนักงานใหญ่",
  pattana: "สาขาสี่แยกพัฒนา",
};

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
  branch_name: "สาขา",
  remark: "หมายเหตุ",
  last_modified: "แก้ไขล่าสุด",
  agree: " ",
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
  detail: z.string().nonempty("กรุณาใส่รายละเอียดค่าใช้จ่าย"),
  total_amount: z.number(),
  payment_date: z.date(),
  payment_mode: z.string(),
  agree: z.boolean().refine((val) => val === true, {
    message: "กรุณาตรวจสอบข้อมูลก่อนบันทึก",
  }),
});

export type ExpenseFormDefaultValueType = {
  company_name: string;
  invoice_number: string;
  receipt_number: string;
  expense_group: string;
  detail: string;
  total_amount: number;
  payment_date: Date;
  payment_mode: string;
  remark: string;
  agree: boolean;
};

export const expenseFormDefaultValue = {
  company_name: "",
  invoice_number: "",
  receipt_number: "",
  expense_group: "",
  detail: "",
  total_amount: 0,
  payment_date: new Date(),
  payment_mode: "",
  remark: "",
  agree: false,
};

type ExpenseFormProps = {
  defaultValues: ExpenseFormDefaultValueType;
  update?: boolean;
};

function getFormInput(
  field: FieldValues,
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    // number
    case "total_amount":
      return (
        <Input
          type="number"
          //className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          {...field}
          {...form.register(field.name, {
            valueAsNumber:
              !field.value?.toString() === undefined ? false : true,
          })}
        />
      );
      break;

    //date time picker
    case "payment_date":
      return <DatePickerInput field={field} />;
      break;

    case "bill_pictures":
      return <ImageDropableForm field={field} />;
      break;

    case "agree":
      return (
        <Label className="flex gap-4 items-center just">
          <Checkbox onCheckedChange={field.onChange} />
          <span>ยืนยันว่าข้อมูลถูกต้องแล้ว</span>
        </Label>
      );

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

export default function ExpenseForm({
  defaultValues,
  update = false,
}: ExpenseFormProps) {
  const { branch } = useParams();

  console.log(branch);

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

      branch_name: branch,
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
        getFormInput={getFormInput}
        className={"flex flex-col gap-8 p-10 max-w-3xl"}
        submitLabel="บันทึก"
      />
    </>
  );
}
