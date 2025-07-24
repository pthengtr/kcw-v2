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
import ExpenseTypeInput from "./ExpenseTypeInput";
import ExpensePaymentModeInput from "./ExpensePaymentModeInput";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";
import { commonUploadFile } from "@/lib/utils";

export const branchLabel = {
  all: "ทั้งหมด",
  main: "สำนักงานใหญ่",
  pattana: "สาขาสี่แยกพัฒนา",
};

export const expenseFieldLabel = {
  id: "รายการเลขที่",
  created_at: "สร้าง",
  company_name: "ชื่อร้าน/บริษัท",
  invoice_date: "วันที่ใบกำกับ/ใบแจ้งหนี้",
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
  user_id: "พนักงาน",
  receipt_pictures: "รูปใบเสร็จ/ใบกำกับ",
  agree: " ",
};

export function getFieldLabel(field: FieldValues) {
  return expenseFieldLabel[field.name as keyof typeof expenseFieldLabel]
    ? expenseFieldLabel[field.name as keyof typeof expenseFieldLabel]
    : field.name;
}

const formSchema = z.object({
  company_name: z.string().nonempty("กรุณาใส่ชื่อร้าน/บริษัท"),
  invoice_date: z.date().optional(),
  invoice_number: z
    .string()
    .nonempty("กรุณาใส่เลขที่ใบกำกับ/ใบแจ้งหนี้")
    .optional(),
  receipt_number: z.string().optional(),
  expense_group: z.string().nonempty("กรุณาเลือกประเภทบัญชี"),
  detail: z.string().nonempty("กรุณาใส่รายละเอียดค่าใช้จ่าย"),
  total_amount: z.number(),
  payment_date: z.union([z.date().nullable().optional(), z.literal("")]),
  payment_mode: z.string(),
  receipt_pictures: z.array(z.custom<File>((file) => file instanceof File)),
  agree: z.boolean().refine((val) => val === true, {
    message: "กรุณาตรวจสอบข้อมูลก่อนบันทึก",
  }),
});

export type ExpenseFormDefaultValueType = {
  company_name: string;
  invoice_date?: Date;
  invoice_number?: string;
  receipt_number?: string;
  expense_group: string;
  detail: string;
  total_amount: number;
  payment_date: Date | null;
  payment_mode: string;
  remark: string;
  agree: boolean;
  receipt_pictures: File[];
};

export const expenseFormDefaultValue = {
  company_name: "",
  invoice_date: new Date(),
  invoice_number: "",
  receipt_number: "",
  expense_group: "",
  detail: "",
  total_amount: 0,
  payment_date: null,
  payment_mode: "",
  remark: "",
  receipt_pictures: [],
  agree: false,
};

export const expenseFormNoVatDefaultValue = {
  company_name: "",
  expense_group: "",
  detail: "",
  total_amount: 0,
  payment_date: null,
  payment_mode: "",
  remark: "",
  receipt_pictures: [],
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

    case "invoice_date":
      return <DatePickerInput field={field} />;
      break;
    //date time picker
    case "payment_date":
      return <DatePickerInput field={field} timePicker optional />;
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

    case "expense_group":
      return <ExpenseTypeInput field={field} />;

    case "payment_mode":
      return <ExpensePaymentModeInput field={field} />;

    case "receipt_pictures":
      return <ImageDropableForm field={field} />;

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

  const {
    setSubmitError,
    selectedRow,
    setSelectedRow,
    setOpenCreateNoVatDialog,
    setOpenUpdateDialog,
    setOpenCreateVatDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

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

      branch_name: branchLabel[branch as keyof typeof branchLabel],
      company_name: formData.get("company_name") as string,
      invoice_date: formData.get("invoice_date") as string,
      invoice_number: formData.get("invoice_number") as string,
      receipt_number: formData.get("receipt_number") as string,
      expense_group: formData.get("expense_group") as string,
      detail: formData.get("detail") as string,
      total_amount: parseFloat(
        formData.get("total_amount") as string
      ) as number,
      payment_date: formData.get("payment_date") as string,
      payment_mode: formData.get("payment_mode") as string,
      user_id: user.email,
      last_modified: new Date().toLocaleString("en-US"),
    };

    console.log(insertData);

    //update or insert new data
    const query =
      update && selectedRow
        ? supabase
            .from("expense")
            .update([insertData])
            .eq("id", selectedRow.id)
            .select()
        : supabase.from("expense").insert([insertData]).select();

    const { data, error } = await query;

    console.log(data, error);

    if (error) {
      setSubmitError(
        "เกิดข้อผิดพลาด กรุณาตรวจสอบชื่อบริษัทกับเลขที่ใบวางบิลอีกครั้ง"
      );
      toast.error(
        "เกิดข้อผิดพลาด กรุณาตรวจสอบชื่อบริษัทกับเลขที่ใบวางบิลอีกครั้ง"
      );
      return;
    }

    if (data) {
      const imageId = `${data[0].id}`;

      const receipt_pictures = formData.getAll("receipt_pictures[]") as File[];
      receipt_pictures.forEach((item) =>
        commonUploadFile({
          picture: item,
          imageId,
          imageFolder: "expense",
        })
      );

      // clear error messsage
      setSubmitError(undefined);

      setSelectedRow(data[0]);

      // close dialog oon succss
      if (update) setOpenUpdateDialog(false);
      else {
        setOpenCreateVatDialog(false);
        setOpenCreateNoVatDialog(false);
      }

      toast.success(update ? "แก้ไขรายการสำเร็จ" : "สร้างรายการสำเร็จ");
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const {
        company_name,
        invoice_date,
        invoice_number,
        receipt_number,
        expense_group,
        detail,
        total_amount,
        payment_date,
        payment_mode,
        receipt_pictures,
      } = values;

      const formData = new FormData();

      if (company_name) {
        formData.append("company_name", company_name);
      }
      if (invoice_date) {
        formData.append("invoice_date", invoice_date.toLocaleString("en-US"));
      }
      if (invoice_number) {
        formData.append("invoice_number", invoice_number);
      }
      if (receipt_number) {
        formData.append("receipt_number", receipt_number);
      }
      formData.append("expense_group", expense_group);
      formData.append("detail", detail);
      formData.append("total_amount", total_amount.toString());
      if (payment_date) {
        formData.append("payment_date", payment_date.toLocaleString("en-US"));
      }

      formData.append("payment_mode", payment_mode);

      receipt_pictures.forEach((item) => {
        formData.append("receipt_pictures[]", item);
      });

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
