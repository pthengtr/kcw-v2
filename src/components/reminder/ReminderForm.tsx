"use client";

import { toast } from "sonner";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";
import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { ReminderDefaultValueType } from "./ReminderColumn";
import { useContext } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import { commonUploadFile } from "@/lib/utils";
import { getImageArray } from "../common/ImageCarousel";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DatePickerInput } from "../common/DatePickerInput";
import ImageDropableForm from "../common/ImageDropableForm";
import BankInfoInput from "./BankInfoInput";
import SupplierNameInput from "./SupplierNameInput";

export const reminderFieldLabel = {
  id: "รายการเลขที่",
  created_at: "สร้าง",
  supplier_name: "บริษัท",
  note_id: "เลขที่ใบวางบิล",
  bill_count: "จำนวนบิล",
  start_date: "บิลวันที่",
  end_date: "ถีง",
  total_amount: "จำนวนเงิน (หักส่วนลดแล้ว)",
  discount: "ส่วนลด",
  user_id: "พนักงาน",
  due_date: "กำหนดชำระ",
  kbiz_datetime: "แจ้งเตือน KBIZ",
  payment_date: "วันที่ชำระ",
  remark: "หมายเหตุ",
  last_modified: "แก้ไขล่าสุด",
  bank_info: "รายละเอียดการชำระเงิน",
  bank_name: "ชื่อธนาคาร",
  bank_account_name: "ชื่อบัญชี",
  bank_account_number: "เลขบัญชี",
  bill_pictures: "เพิ่มรูปบิล/ใบวางบิล",
  payment_pictures: "เพิ่มรูปหลักฐานการขำระเงิน",
  agree: " ",
};

function getFieldLabel(field: FieldValues) {
  return reminderFieldLabel[field.name as keyof typeof reminderFieldLabel]
    ? reminderFieldLabel[field.name as keyof typeof reminderFieldLabel]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    // number
    case "bill_count":
    case "total_amount":
    case "discount":
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

    //date picker
    case "start_date":
    case "end_date":
    case "due_date":
      return <DatePickerInput field={field} />;
      break;

    //date time picker
    case "payment_date":
    case "kbiz_datetime":
      return <DatePickerInput field={field} timePicker optional />;
      break;

    case "supplier_name":
      return <SupplierNameInput field={field} />;
      break;

    case "bank_info":
      return <BankInfoInput />;
      break;

    case "bill_pictures":
    case "payment_pictures":
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
  kbiz_datetime: z.union([z.date().nullable().optional(), z.literal("")]),
  payment_date: z.union([z.date().nullable().optional(), z.literal("")]),
  bill_pictures: z.array(z.custom<File>((file) => file instanceof File)),
  payment_pictures: z.array(z.custom<File>((file) => file instanceof File)),
  bank_info: z
    .object({
      bank_name: z.string(),
      bank_account_name: z.string(),
      bank_account_number: z.string(),
    })
    .nullable(),
  remark: z.string(),
  agree: z.boolean().refine((val) => val === true, {
    message: "กรุณาตรวจสอบข้อมูลก่อนบันทึก",
  }),
});

type ReminderFormProps = {
  defaultValues: ReminderDefaultValueType;
  update?: boolean;
};

export default function ReminderForm({
  defaultValues,
  update = false,
}: ReminderFormProps) {
  const {
    selectedRow,
    setOpenCreateDialog,
    setOpenUpdateDialog,
    setSubmitError,
    bankName,
    bankAccountName,
    bankAccountNumber,
    selectedBankInfo,
    setSelectedRow,
    saveBankInfo,
    setBillImageArray,
    setPaymentImageArray,
  } = useContext(ReminderContext) as ReminderContextType;

  async function createUpdateReminder(formData: FormData) {
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
      supplier_name: formData.get("supplier_name") as string,
      note_id: formData.get("note_id") as string,
      bill_count: parseInt(formData.get("bill_count") as string) as number,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      total_amount: parseFloat(
        formData.get("total_amount") as string
      ) as number,
      discount: parseFloat(formData.get("discount") as string) as number,
      user_id: user.email,
      due_date: formData.get("due_date") as string,
      kbiz_datetime: formData.get("kbiz_datetime") as string,
      payment_date: formData.get("payment_date") as string,
      remark: formData.get("remark") as string,
      last_modified: new Date().toLocaleString("en-US"),
      bank_name: selectedBankInfo ? selectedBankInfo.bank_name : bankName,
      bank_account_name: selectedBankInfo
        ? selectedBankInfo.bank_account_name
        : bankAccountName,
      bank_account_number: selectedBankInfo
        ? selectedBankInfo.bank_account_number
        : bankAccountNumber,
    };

    //update or insert new data
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
      const imageId = `${insertData.supplier_name
        .toString()
        .replace(/[^A-Za-z0-9]/g, "")}_${insertData.note_id
        .toString()
        .replace(/[^A-Za-z0-9]/g, "")}`;

      const bill_pictures = formData.getAll("bill_pictures[]") as File[];
      bill_pictures.forEach((item) =>
        commonUploadFile({
          picture: item,
          imageId,
          imageFolder: "reminder_bill",
        })
      );

      const payment_pictures = formData.getAll("payment_pictures[]") as File[];
      payment_pictures.forEach((item) =>
        commonUploadFile({
          picture: item,
          imageId,
          imageFolder: "reminder_payment",
        })
      );

      // clear error messsage
      setSubmitError(undefined);

      setSelectedRow(data[0]);

      await getImageArray(
        "reminder_bill",
        `${data[0].supplier_name
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}_${data[0].note_id
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}`,
        setBillImageArray
      );

      await getImageArray(
        "reminder_payment",
        `${data[0].supplier_name
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}_${data[0].note_id
          .toString()
          .replace(/[^A-Za-z0-9]/g, "")}`,
        setPaymentImageArray
      );

      // close dialog oon succss
      if (update) setOpenUpdateDialog(false);
      else setOpenCreateDialog(false);

      toast.success(update ? "แก้ไขรายการสำเร็จ" : "สร้างรายการสำเร็จ");
    }

    //save bank info
    if (saveBankInfo) {
      const { data: dataBankInfo, error: errorBankInfo } = await supabase
        .from("supplier_bank_info")
        .insert([
          {
            supplier_name: insertData.supplier_name,
            bank_name: insertData.bank_name,
            bank_account_name: insertData.bank_account_name,
            bank_account_number: insertData.bank_account_number,
          },
        ])
        .select();

      console.log(dataBankInfo, errorBankInfo);
      if (dataBankInfo) toast.success("เพิ่มข้อมูลบัญชีธนาคารใหม่สำเร็จ");
      if (errorBankInfo) toast.error("เพิ่มข้อมูลบัญชีธนาคารใหม่ไม่สำเร็จ");
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const {
        supplier_name,
        bill_count,
        start_date,
        end_date,
        note_id,
        total_amount,
        discount,
        due_date,
        kbiz_datetime,
        payment_date,
        bill_pictures,
        payment_pictures,
        remark,
      } = values;

      const formData = new FormData();
      formData.append("supplier_name", supplier_name);
      formData.append("note_id", note_id);
      formData.append("bill_count", bill_count.toString());
      formData.append("start_date", start_date.toLocaleString("en-US"));
      formData.append("end_date", end_date.toLocaleString("en-US"));
      formData.append("total_amount", total_amount.toString());
      formData.append("discount", discount.toString());
      formData.append("due_date", due_date.toLocaleString("en-US"));
      if (kbiz_datetime) {
        formData.append("kbiz_datetime", kbiz_datetime.toLocaleString("en-US"));
      }
      if (payment_date) {
        formData.append("payment_date", payment_date.toLocaleString("en-US"));
      }
      formData.append("remark", remark);

      bill_pictures.forEach((item) => {
        formData.append("bill_pictures[]", item);
      });

      payment_pictures.forEach((item) => {
        formData.append("payment_pictures[]", item);
      });

      await createUpdateReminder(formData);

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
