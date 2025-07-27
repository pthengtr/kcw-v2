"use client";

import { useCallback, useContext, useEffect } from "react";
import { SupplierContext, SupplierContextType } from "./SupplierProvider";
import SupplierSearchForm from "./SupplierSearchForm";
import { DataTable } from "../common/DataTable";
import { supplierColumn } from "./SupplierColumn";
import { createClient } from "@/lib/supabase/client";

export default function SupplierTable() {
  const {
    suppliers,
    setSuppliers,
    total,
    setTotal,
    setSelectedRow,
    setSubmitError,
  } = useContext(SupplierContext) as SupplierContextType;

  const supabase = createClient();

  const getSuppliers = useCallback(
    async function () {
      const query = supabase
        .from("supplier")
        .select("*", { count: "exact" })
        .order("supplier_id", { ascending: true })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setSuppliers(data);
      }
      if (count) setTotal(count);
    },
    [setSuppliers, setTotal, supabase]
  );

  useEffect(() => {
    setSubmitError(undefined);
    getSuppliers();
  }, [getSuppliers, setSubmitError]);

  return (
    <div className="flex flex-col gap-2 p-2 w-fit">
      <div className="flex justify-center items-center p-4 gap-4">
        <div>
          <SupplierSearchForm
            defaultValues={{
              supplier_code: "",
              supplier_name: "",
            }}
          />
        </div>
      </div>

      <div className="h-full">
        {!!suppliers && (
          <DataTable
            tableName="supplier"
            columns={supplierColumn}
            data={suppliers}
            total={total}
            setSelectedRow={setSelectedRow}
          >
            <div className="flex gap-4 mr-auto px-8">
              <h2 className="text-2xl font-bold flex-1">{`รายชื่อบริษัท`}</h2>
            </div>
          </DataTable>
        )}
      </div>
    </div>
  );
}
