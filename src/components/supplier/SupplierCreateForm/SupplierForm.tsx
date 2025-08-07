"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "@/components/common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";

import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SupplierContext, SupplierContextType } from "../SupplierProvider";

export type SupplierFormDefaultType = {
  supplier_code: string;
  supplier_name: string;
};

export const supplierFormDefaultValues: SupplierFormDefaultType = {
  supplier_code: "",
  supplier_name: "",
};

const searchFormFieldLabel = {
  supplier_code: "ชื่อย่อบริษัท",
  supplier_name: "ชื่อบริษัท",
};

function getFieldLabel(field: FieldValues) {
  return searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
    ? searchFormFieldLabel[field.name as keyof typeof searchFormFieldLabel]
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
  supplier_code: z.string(),
  supplier_name: z.string(),
});

type SupplierFormProps = {
  defaultValues: SupplierFormDefaultType;
  update?: boolean;
};

export default function SupplierForm({
  defaultValues,
  update = false,
}: SupplierFormProps) {
  const {
    setTotal,
    selectedRow,
    setOpenCreateDialog,
    setOpenUpdateDialog,
    setSubmitError,
    setSuppliers,
  } = useContext(SupplierContext) as SupplierContextType;

  async function createUpdateSupplier(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs
    const supplierFormData = {
      supplier_code: formData.get("supplier_code") as string,
      supplier_name: formData.get("supplier_name") as string,
    };

    const supabase = createClient();

    const query =
      update && selectedRow
        ? supabase
            .from("supplier")
            .update([supplierFormData])
            .eq("supplier_uuid", selectedRow.supplier_uuid)
            .select()
        : supabase.from("supplier").insert([supplierFormData]).select();

    const { data, error, count } = await query;

    if (error) {
      setSubmitError(error.message);
      toast.error("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
    }

    if (data) {
      setSubmitError(undefined);
      if (update) {
        setSuppliers(data);
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        toast.success("สร้างข้อมูลใหม่สำเร็จ");
      }
    }

    if (count) setTotal(count);

    setOpenUpdateDialog(false);
    setOpenCreateDialog(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { supplier_code, supplier_name } = values;

    const formData = new FormData();

    formData.append("supplier_code", supplier_code);
    formData.append("supplier_name", supplier_name);

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
