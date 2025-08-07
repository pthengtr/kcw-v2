"use client";

import { useContext, useEffect } from "react";
import { SupplierContext, SupplierContextType } from "../SupplierProvider";

import { DataTable } from "../../common/DataTable";
import {
  defaultSupplierColumnVisibility,
  supplierColumn,
} from "./SupplierColumn";
import SupplierTableHeader from "./SupplierTableHeader";

export default function SupplierTable() {
  const {
    suppliers,
    total,
    getSuppliers,
    setSelectedRow,
    setSubmitError,
    openCreateDialog,
    openUpdateDialog,
    openCreateTaxFormDialog,
    openUpdateTaxFormDialog,
  } = useContext(SupplierContext) as SupplierContextType;

  useEffect(() => {
    setSubmitError(undefined);
    getSuppliers();
  }, [
    getSuppliers,
    setSubmitError,
    openCreateDialog,
    openUpdateDialog,
    openCreateTaxFormDialog,
    openUpdateTaxFormDialog,
  ]);

  return (
    <div className="h-full">
      {!!suppliers && (
        <DataTable
          tableName="supplier"
          columns={supplierColumn}
          data={suppliers}
          total={total}
          setSelectedRow={setSelectedRow}
          initialState={{ columnVisibility: defaultSupplierColumnVisibility }}
        >
          <SupplierTableHeader />
        </DataTable>
      )}
    </div>
  );
}
