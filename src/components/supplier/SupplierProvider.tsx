"use client";
import { createClient } from "@/lib/supabase/client";
import { SupplierType } from "@/lib/types/models";
import { createContext, useCallback, useState } from "react";
import React from "react";

export type SupplierContextType = {
  suppliers: SupplierType[] | undefined;
  setSuppliers: (suppliers: SupplierType[] | undefined) => void;
  selectedRow: SupplierType | undefined;
  setSelectedRow: (selectedRow: SupplierType | undefined) => void;
  openCreateDialog: boolean;
  setOpenCreateDialog: (open: boolean) => void;
  openUpdateDialog: boolean;
  setOpenUpdateDialog: (open: boolean) => void;
  openCreateTaxFormDialog: boolean;
  setOpenCreateTaxFormDialog: (open: boolean) => void;
  openUpdateTaxFormDialog: boolean;
  setOpenUpdateTaxFormDialog: (open: boolean) => void;
  openDeleteDialog: boolean;
  setOpenDeleteDialog: (open: boolean) => void;
  openDeleteTaxFormDialog: boolean;
  setOpenDeleteTaxFormDialog: (open: boolean) => void;
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  total: number | undefined;
  setTotal: (total: number) => void;
  getSuppliers: () => void;
};

export const SupplierContext = createContext<SupplierContextType | null>(null);

type ExpenseProviderProps = {
  children: React.ReactNode;
};

export default function SupplierProvider({ children }: ExpenseProviderProps) {
  const [selectedRow, setSelectedRow] = useState<SupplierType>();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
  const [openCreateTaxFormDialog, setOpenCreateTaxFormDialog] = useState(false);
  const [openUpdateTaxFormDialog, setOpenUpdateTaxFormDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openDeleteTaxFormDialog, setOpenDeleteTaxFormDialog] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierType[]>();
  const [submitError, setSubmitError] = useState<string>();
  const [total, setTotal] = useState<number>();

  const getSuppliers = useCallback(
    async function () {
      const supabase = createClient();
      const query = supabase
        .from("supplier")
        .select("*, supplier_tax_info(*)", { count: "exact" })
        .order("supplier_uuid", { ascending: false })
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
    [setSuppliers, setTotal]
  );

  const value = {
    suppliers,
    setSuppliers,
    selectedRow,
    setSelectedRow,
    submitError,
    setSubmitError,
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setOpenUpdateDialog,
    openDeleteDialog,
    setOpenDeleteDialog,
    openCreateTaxFormDialog,
    setOpenCreateTaxFormDialog,
    openUpdateTaxFormDialog,
    setOpenUpdateTaxFormDialog,
    openDeleteTaxFormDialog,
    setOpenDeleteTaxFormDialog,
    total,
    setTotal,
    getSuppliers,
  };

  return (
    <SupplierContext.Provider value={value}>
      {children}
    </SupplierContext.Provider>
  );
}
