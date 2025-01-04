"use client";
import { Input } from "@/components/ui/input";
import { ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import {
  ProductType,
  productColumns,
} from "@/components/product/ProductColumns";
import { DataTable } from "@/components/common/DataTable";

export default function Product() {
  const [products, setProducts] = useState<ProductType[]>();
  const [total, setTotal] = useState<number>();
  const [selectedRow, setSelectedRow] = useState<ProductType>();

  const supabase = createClient();

  useEffect(() => {
    async function getProduct() {
      const { data, error, count } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .limit(100);

      if (error) console.log(error);

      if (data) setProducts(data);
      if (count) setTotal(count);
    }

    getProduct();
  }, [supabase]);

  async function uploadFile(picture: File) {
    const { data, error } = await supabase.storage
      .from("pictures")
      .upload(`public/${picture.name}`, picture);

    if (!!error) console.log(error);
    if (!!data) console.log(data);
  }

  function handleDropPicture(e: React.DragEvent) {
    e.preventDefault();
    console.log(e.dataTransfer.files[0]);
    uploadFile(e.dataTransfer.files[0]);
  }

  function handleFileChange(e: React.ChangeEvent) {
    console.log(e);
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="grid place-content-center">
        Current Selected {selectedRow?.BCODE}
      </div>
      <div className="h-full">
        {!!products && (
          <DataTable
            columns={productColumns}
            data={products}
            total={total}
            setSelectedRow={setSelectedRow}
          ></DataTable>
        )}
      </div>
      <div className="w-full grid place-content-center">
        <div
          onDrop={handleDropPicture}
          onDragOver={(e) => e.preventDefault()}
          className="grid place-content-center border rounded-md"
        >
          <Label htmlFor="file" className="grid place-content-center">
            <ImagePlus size={96} />
          </Label>
        </div>
      </div>
      <Input
        id="file"
        className="visible"
        type="file"
        onChange={handleFileChange}
      />
    </main>
  );
}
