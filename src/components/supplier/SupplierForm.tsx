"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { SupplierContext, SupplierContextType } from "./SupplierProvider";

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

type SupplierDefaultType = {
  supplier_code: string;
  supplier_name: string;
};

type SupplierFormProps = {
  defaultValues: SupplierDefaultType;
  update?: boolean;
};

export default function SupplierForm({
  defaultValues,
  update = false,
}: SupplierFormProps) {
  const { setSuppliers, setTotal, selectedRow } = useContext(
    SupplierContext
  ) as SupplierContextType;

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
            .from("payment_reminder")
            .update([supplierFormData])
            .eq("supplier_id", selectedRow.supplier_id)
            .select()
        : supabase.from("supplier").insert([supplierFormData]).select();

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setSuppliers(data);
    }
    if (count) setTotal(count);
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
      className="flex justify-center items-center gap-4 pxs-12"
      submitLabel={<Search />}
    />
  );
}
