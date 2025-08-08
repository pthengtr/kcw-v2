"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "@/components/common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ExpenseGeneralType, UUID } from "@/lib/types/models";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpensePaymentMethodSelectInput from "../ExpensePaymentMethodSelectInput";
import ExpenseBranchSelectInput from "../ExpenseBranchSelectInput";
import { DatePickerInput } from "@/components/common/DatePickerInput";
import ExpenseSelectItemDialogInput from "../ExpenseSelectItemDialogInput";

export type ExpenseGeneralFormDefaultType = {
  payment_uuid: UUID;
  branch_uuid: UUID;
  item_uuid: UUID;
  entry_date: Date;
  description: string;
  unit_price: number;
  quantity: number;
  remark: string;
};

export const expenseGeneralFormDefaultValues: ExpenseGeneralFormDefaultType = {
  entry_date: new Date(),
  branch_uuid: "",
  item_uuid: "",
  description: "",
  unit_price: 0,
  quantity: 0,
  payment_uuid: "",
  remark: "",
};

const expenseGeneralFormFieldLabel = {
  payment_uuid: "ชำระโดย",
  branch_uuid: "สาขา",
  item_uuid: "ประเภทค่าใชัจ่าย",
  entry_date: "วันที่บิล",
  description: "รายละเอียด",
  unit_price: "ราคาต่อหน่วย",
  quantity: "จำนวน",
  remark: "หมายเหตุ",
};

function getFieldLabel(field: FieldValues) {
  return expenseGeneralFormFieldLabel[
    field.name as keyof typeof expenseGeneralFormFieldLabel
  ]
    ? expenseGeneralFormFieldLabel[
        field.name as keyof typeof expenseGeneralFormFieldLabel
      ]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    case "payment_uuid":
      return <ExpensePaymentMethodSelectInput />;
    case "branch_uuid":
      return <ExpenseBranchSelectInput field={field} />;
    case "entry_date":
      return <DatePickerInput field={field} />;
    case "item_uuid":
      return <ExpenseSelectItemDialogInput field={field} />;

    case "unit_price":
    case "quantity":
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

    case "description":
    case "remark":
    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  payment_uuid: z.string(),
  branch_uuid: z.string().nonempty("กรุณาเลือกสาขา"),
  item_uuid: z.string().nonempty("กรุณาเลือกประเภทค่าใช้จ่าย"),
  entry_date: z.coerce.date({
    required_error: "กรุณาระบุวันที่",
    invalid_type_error: "วันที่ไม่ถูกต้อง",
  }),
  description: z.string().nonempty("กรุณาเลือกใส่รายละเอียด"),
  unit_price: z.number().refine((val) => val !== 0, {
    message: "กรุณาใส่ราคาให้ถูกต้อง",
  }),
  quantity: z.number().refine((val) => val !== 0, {
    message: "กรุณาใส่จำนวนให้ถูกต้อง",
  }),
  remark: z.string(),
});

type ExpenseGeneralCreateFormProps = {
  defaultValues: ExpenseGeneralFormDefaultType;
  update?: boolean;
};

export default function ExpenseGeneralCreateForm({
  defaultValues,
  update = false,
}: ExpenseGeneralCreateFormProps) {
  const {
    setGeneralEntries,
    selectedGeneralEntry,
    setOpenCreateExpenseGeneralDialog,
    setOpenUpdateExpenseGeneralDialog,
    setSubmitError,
    setTotalGeneralEntries,
    selectedPaymentMethod,
    setPaymentMethodFormError,
  } = useContext(ExpenseContext) as ExpenseContextType;

  async function createUpdateSupplier(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs

    if (!selectedPaymentMethod) {
      setPaymentMethodFormError("กรุณาเลือกวิธีการชำระ");
      return;
    } else {
      setPaymentMethodFormError(undefined);
    }

    const expenseGeneralFormData: Omit<
      ExpenseGeneralType,
      | "general_uuid"
      | "created_at"
      | "payment_method"
      | "branch"
      | "expense_item"
    > = {
      payment_uuid: selectedPaymentMethod.payment_uuid,
      branch_uuid: formData.get("branch_uuid") as string,
      item_uuid: formData.get("item_uuid") as string,
      entry_date: formData.get("entry_date") as string,
      description: formData.get("description") as string,
      unit_price: parseFloat(formData.get("unit_price") as string),
      quantity: parseInt(formData.get("quantity") as string),
      remark: formData.get("remark") as string,
    };

    const supabase = createClient();

    const query =
      update && selectedGeneralEntry
        ? supabase
            .from("expense_general")
            .update([expenseGeneralFormData])
            .eq("general_uuid", selectedGeneralEntry.general_uuid)
            .select()
        : supabase
            .from("expense_general")
            .insert([expenseGeneralFormData])
            .select();

    const { data, error, count } = await query;

    if (error) {
      setSubmitError(error.message);
      toast.error("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
    }

    if (data) {
      setSubmitError(undefined);
      if (update) {
        setGeneralEntries(data);
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        toast.success("สร้างข้อมูลใหม่สำเร็จ");
      }
    }

    if (count !== null && count !== undefined) setTotalGeneralEntries(count);

    setOpenCreateExpenseGeneralDialog(false);
    setOpenUpdateExpenseGeneralDialog(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const {
      payment_uuid,
      branch_uuid,
      item_uuid,
      entry_date,
      description,
      unit_price,
      quantity,
      remark,
    } = values;

    const formData = new FormData();

    formData.append("payment_uuid", payment_uuid);
    formData.append("branch_uuid", branch_uuid);
    formData.append("item_uuid", item_uuid);
    formData.append("entry_date", new Date(entry_date).toLocaleString("en-US"));
    formData.append("description", description);
    formData.append("unit_price", unit_price.toString());
    formData.append("quantity", quantity.toString());
    formData.append("remark", remark);

    await createUpdateSupplier(formData);
  }
  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex flex-col justify-center items-center gap-4"
      submitLabel="บันทึก"
    />
  );
}
