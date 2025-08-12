"use client";

import * as z from "zod";
import { createClient } from "@/lib/supabase/client";

import Form from "@/components/common/Form";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useContext } from "react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { ProductContext, ProductContextType } from "./ProductProvider";

const searchFormFieldLabel = {
  barcode: "บาร์โค้ด",
  product_name: "ชื่อสินค้า",
  sku: "รหัส SKU",
} as const;

function getFieldLabel(field: FieldValues) {
  const key = field.name as keyof typeof searchFormFieldLabel;
  return searchFormFieldLabel[key] ?? field.name;
}

function getFormInput(
  field: FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  form: UseFormReturn<z.infer<typeof formSchema>>
) {
  // all simple text inputs for MVP
  return <Input type="text" {...field} />;
}

export const skuSearchDefaultValues = {
  barcode: "",
  product_name: "",
  sku: "",
};

const formSchema = z.object({
  barcode: z.string(),
  product_name: z.string(),
  sku: z.string(),
});

export type ProductSearchDefault = z.infer<typeof formSchema>;

type Props = {
  defaultValues: ProductSearchDefault;
};

export default function SkuSearchForm({ defaultValues }: Props) {
  const { setSkus, setTotal } = useContext(
    ProductContext
  ) as ProductContextType;

  async function searchProducts(formData: FormData) {
    const barcode = (formData.get("barcode") as string)?.trim();
    const product_name = (formData.get("product_name") as string)?.trim();
    const sku = (formData.get("sku") as string)?.trim();

    const supabase = createClient();

    // Start with base query to the catalog view
    let catalog = supabase
      .from("v_sku_catalog")
      .select("*", { count: "exact" })
      .order("sku_code", { ascending: true })
      .limit(1000);

    // If barcode provided, resolve sku_uuids from *any* barcode (not only primary)
    if (barcode) {
      const { data: bcData, error: bcErr } = await supabase
        .from("barcode")
        .select("sku_uuid")
        .ilike("barcode", `%${barcode}%`)
        .limit(1000);

      if (bcErr) {
        console.error(bcErr);
        return;
      }

      const ids = (bcData ?? []).map((r) => r.sku_uuid);
      if (ids.length === 0) {
        // no matches → clear results
        setSkus([]);
        setTotal(0);
        return;
      }
      catalog = catalog.in("sku_uuid", ids);
    }

    if (product_name)
      catalog = catalog.ilike("product_name", `%${product_name}%`);
    if (sku) catalog = catalog.ilike("sku_code", `%${sku}%`);

    const { data, error, count } = await catalog;

    if (error) {
      console.error(error);
      return;
    }

    setSkus(data ?? []);
    if (count !== null && count !== undefined) setTotal(count);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append("barcode", values.barcode ?? "");
    formData.append("product_name", values.product_name ?? "");
    formData.append("sku", values.sku ?? "");
    await searchProducts(formData);
  }

  return (
    <Form
      schema={formSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      getFieldLabel={getFieldLabel}
      getFormInput={getFormInput}
      className="flex items-end gap-4"
      submitLabel={<Search />}
    />
  );
}
