"use client";

import { useCallback, useContext, useEffect } from "react";
import { SupplierContext, SupplierContextType } from "./SupplierProvider";
import SupplierSearchForm from "./SupplierSearchForm";
import { DataTable } from "../common/DataTable";
import { supplierColumn } from "./SupplierColumn";
import { createClient } from "@/lib/supabase/client";
import SupplierFormDialog from "./SupplierFormDialog";
import { Pencil, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { supplierFormDefaultValues } from "./SupplierForm";
import SupplierDeleteDialog from "./SupplierDeleteDialog";

export default function SupplierTable() {
  const {
    suppliers,
    setSuppliers,
    total,
    setTotal,
    selectedRow,
    setSelectedRow,
    setSubmitError,
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setOpenUpdateDialog,
    openDeleteDialog,
  } = useContext(SupplierContext) as SupplierContextType;

  const supabase = createClient();

  const getSuppliers = useCallback(
    async function () {
      const query = supabase
        .from("supplier")
        .select("*", { count: "exact" })
        .order("supplier_id", { ascending: false })
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
  }, [
    getSuppliers,
    setSubmitError,
    openCreateDialog,
    openUpdateDialog,
    openDeleteDialog,
  ]);

  return (
    <div className="flex flex-col items-center gap-4 p-2">
      <div className="flex gap-4 items-end">
        <SupplierSearchForm
          defaultValues={{
            supplier_code: "",
            supplier_name: "",
          }}
        />
        <SupplierFormDialog
          open={openCreateDialog}
          setOpen={setOpenCreateDialog}
          dialogTrigger={
            <Button id="create-expense-novat">
              <Plus />
            </Button>
          }
          dialogHeader={`เพิ่มรายชื่อบริษัท`}
          defaultValues={supplierFormDefaultValues}
        />
        {selectedRow && (
          <>
            <SupplierFormDialog
              update
              open={openUpdateDialog}
              setOpen={setOpenUpdateDialog}
              dialogTrigger={
                <Button id="create-expense-novat">
                  <Pencil />
                </Button>
              }
              dialogHeader={`แก้ไขรายชื่อบริษัท`}
              defaultValues={{
                supplier_code: selectedRow.supplier_code,
                supplier_name: selectedRow.supplier_name,
              }}
            />
            <SupplierDeleteDialog />
          </>
        )}
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
