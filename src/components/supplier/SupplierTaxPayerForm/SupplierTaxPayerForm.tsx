"use client";

import * as z from "zod";

import { createClient } from "@/lib/supabase/client";

import Form from "../../common/Form";
import { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { Input } from "../../ui/input";
import { SupplierContext, SupplierContextType } from "../SupplierProvider";
import { toast } from "sonner";
import { SupplierTaxInfoType } from "@/lib/types/models";
import { Textarea } from "@/components/ui/textarea";

export type SupplierTaxPayerFormDefaultType = {
  tax_payer_id: string;
  address: string;
};

export const supplierTaxPayerFormDefaultValues: SupplierTaxPayerFormDefaultType =
  {
    tax_payer_id: "",
    address: "",
  };

const searchFormFieldLabel = {
  tax_payer_id: "เลขประจำตัวผู้เสียภาษี",
  address: "ที่อยู่",
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
    case "address":
      return <Textarea placeholder="ที่อยู่..." {...field} />;
    //simple text
    default:
      return <Input type="text" {...field} />;
  }
}

const formSchema = z.object({
  tax_payer_id: z
    .string()
    .nonempty("กรุณาใส่เลขประจำตัวผู้เสียภาษี")
    .length(13, "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง"),
  address: z.string().nonempty("กรุณาใส่ที่อยู่"),
});

type SupplierFormProps = {
  defaultValues: SupplierTaxPayerFormDefaultType;
  update?: boolean;
};

export default function SupplierTaxPayerForm({
  defaultValues,
  update = false,
}: SupplierFormProps) {
  const {
    setTotal,
    selectedRow,
    setOpenCreateTaxFormDialog,
    setOpenUpdateTaxFormDialog,
    setSelectedRow,
    setSubmitError,
    getSuppliers,
  } = useContext(SupplierContext) as SupplierContextType;

  async function createUpdateSupplier(formData: FormData) {
    // type-casting here for convenience
    // in practice, you should validate your inputs

    if (!selectedRow) return;

    const supplierFormData: Omit<
      SupplierTaxInfoType,
      "supplier_tax_info_uuid" // auto generate
    > = {
      tax_payer_id: formData.get("tax_payer_id") as string,
      address: formData.get("address") as string,
      supplier_uuid: selectedRow?.supplier_uuid,
    };

    const supabase = createClient();

    const query =
      update && selectedRow
        ? supabase
            .from("supplier_tax_info")
            .update([supplierFormData])
            .eq("supplier_uuid", selectedRow.supplier_uuid)
            .select()
        : supabase
            .from("supplier_tax_info")
            .insert([supplierFormData])
            .select();

    const { data, error, count } = await query;

    if (error) {
      setSubmitError(error.message);
      toast.error("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้");
    }

    if (data) {
      setSubmitError(undefined);
      const newSelectedRow = {
        ...selectedRow,
        supplier_tax_info: data.at(0),
      };
      setSelectedRow(newSelectedRow);
      getSuppliers();
      if (update) {
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        toast.success("สร้างข้อมูลใหม่สำเร็จ");
      }
    }

    if (count !== null && count !== undefined) setTotal(count);

    setOpenCreateTaxFormDialog(false);
    setOpenUpdateTaxFormDialog(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { tax_payer_id, address } = values;

    const formData = new FormData();

    formData.append("tax_payer_id", tax_payer_id);
    formData.append("address", address);

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
