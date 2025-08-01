"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import Form from "@/components/common/Form";

export type ExpenseCategoryDefaultType = {
  category_name: string;
};

export const expenseCategoryFormDefaultValues: ExpenseCategoryDefaultType = {
  category_name: "",
};

const expenseCategoryFormFieldLabel = {
  category_name: "หมวด",
};

function getFieldLabel(field: FieldValues) {
  return expenseCategoryFormFieldLabel[
    field.name as keyof typeof expenseCategoryFormFieldLabel
  ]
    ? expenseCategoryFormFieldLabel[
        field.name as keyof typeof expenseCategoryFormFieldLabel
      ]
    : field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  switch (field.name) {
    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  category_name: z.string().nonempty({ message: "กรุณาใส่ชื่อหมวด" }),
});

type ExpenseCategoryFormProps = {
  defaultValues: ExpenseCategoryDefaultType;
  update?: boolean;
};

export default function ExpenseCategoryForm({
  defaultValues,
  update = false,
}: ExpenseCategoryFormProps) {
  const {
    selectedCategory,
    setSelectedCategory,
    setColumnFilters,
    setSubmitError,
    setOpenAddCategoryDialog,
    setOpenUpdateCategoryDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  async function createUpdateExpenseCategory(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const expenseCategoryFormData = {
      category_name: (formData.get("category_name") as string).replace(
        /\s+$/,
        ""
      ),
    };

    const supabase = createClient();

    const query =
      update && selectedCategory
        ? supabase
            .from("expense_category")
            .update([expenseCategoryFormData])
            .eq("category_id", selectedCategory.category_id)
            .select()
        : supabase
            .from("expense_category")
            .insert([expenseCategoryFormData])
            .select();

    const { data, error } = await query;

    if (error) {
      setSubmitError(error.message);
      toast.error("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
      return;
    }

    if (data) {
      setSubmitError(undefined);
      if (update) {
        setSelectedCategory(data[0]);
        setColumnFilters([{ id: "รหัสหมวด", value: data[0].category_id }]);
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        toast.success("สร้างข้อมูลใหม่สำเร็จ");
      }
    }

    setOpenAddCategoryDialog(false);
    setOpenUpdateCategoryDialog(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { category_name } = values;

    const formData = new FormData();

    formData.append("category_name", category_name);

    await createUpdateExpenseCategory(formData);
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
