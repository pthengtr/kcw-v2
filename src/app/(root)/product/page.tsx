"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import {
  ProductType,
  productColumns,
} from "@/components/product/ProductColumns";
import { DataTable } from "@/components/common/DataTable";
import { ColumnFiltersState } from "@tanstack/react-table";

export default function Product() {
  const [products, setProducts] = useState<ProductType[]>();
  const [total, setTotal] = useState<number>();
  const [selectedRow, setSelectedRow] = useState<ProductType>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

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
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
          ></DataTable>
        )}
      </div>
    </main>
  );
}
