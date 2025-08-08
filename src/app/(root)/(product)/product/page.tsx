"use client";
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
      if (count !== null && count !== undefined) setTotal(count);
    }

    getProduct();
  }, [supabase]);

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
    </main>
  );
}
