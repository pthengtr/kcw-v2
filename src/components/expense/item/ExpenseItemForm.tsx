"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import Form from "@/components/common/Form";
import ExpenseCategorySelectInput from "./ExpenseCategorySelectInput";

export type ExpenseItemDefaultType = {
  item_name: string;
  category_uuid: string;
};

export const expenseItemFormDefaultValues: ExpenseItemDefaultType = {
  item_name: "",
  category_uuid: "",
};

const expenseItemFormFieldLabel = {
  item_name: "ประเภทค่าใช้จ่าย",
  category_uuid: "หมวด",
};

function getFieldLabel(field: FieldValues) {
  return expenseItemFormFieldLabel[
    field.name as keyof typeof expenseItemFormFieldLabel
  ]
    ? expenseItemFormFieldLabel[
        field.name as keyof typeof expenseItemFormFieldLabel
      ]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    case "category_uuid":
      return <ExpenseCategorySelectInput field={field} />;

    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  item_name: z.string().nonempty({ message: "กรุณาใส่ชื่อประเภทค่าใช้จ่าย" }),
  category_uuid: z.string().nonempty({ message: "กรุณาใส่เลือกหมวด" }),
});

type ExpenseItemFormProps = {
  defaultValues: ExpenseItemDefaultType;
  update?: boolean;
};

export default function ExpenseCategoryForm({
  defaultValues,
  update = false,
}: ExpenseItemFormProps) {
  const {
    selectedItem,
    setSubmitError,
    setOpenAddItemDialog,
    setOpenUpdateItemDialog,
    setColumnFilters,
    setSelectedItem,
  } = useContext(ExpenseContext) as ExpenseContextType;

  async function createUpdateExpenseItem(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const expenseItemFormData = {
      item_name: (formData.get("item_name") as string).replace(/\s+$/, ""),
      category_uuid: parseInt(
        formData.get("category_uuid") as string
      ) as number,
    };

    const supabase = createClient();

    const query =
      update && selectedItem
        ? supabase
            .from("expense_item")
            .update([expenseItemFormData])
            .eq("item_uuid", selectedItem.item_uuid)
            .select()
        : supabase.from("expense_item").insert([expenseItemFormData]).select();

    const { data, error } = await query;

    if (error) {
      setSubmitError(error.message);
      toast.error("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
      return;
    }

    if (data) {
      setSubmitError(undefined);
      if (update) {
        setSelectedItem(data[0]);
        setColumnFilters([{ id: "รหัส", value: data[0].item_uuid }]);
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        toast.success("สร้างข้อมูลใหม่สำเร็จ");
      }
    }

    setOpenAddItemDialog(false);
    setOpenUpdateItemDialog(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { item_name, category_uuid } = values;

    const formData = new FormData();

    formData.append("item_name", item_name);
    if (category_uuid)
      formData.append("category_uuid", category_uuid.toString());

    await createUpdateExpenseItem(formData);
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
