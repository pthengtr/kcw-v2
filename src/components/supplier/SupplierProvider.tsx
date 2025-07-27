"use client";
import { createContext, useState } from "react";
import React from "react";
import { SupplierType } from "./SupplierColumn";

export type SupplierContextType = {
  suppliers: SupplierType[] | undefined;
  setSuppliers: (suppliers: SupplierType[] | undefined) => void;
  selectedRow: SupplierType | undefined;
  setSelectedRow: (selectedRow: SupplierType | undefined) => void;
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  total: number | undefined;
  setTotal: (total: number) => void;
};

export const SupplierContext = createContext<SupplierContextType | null>(null);

type ExpenseProviderProps = {
  children: React.ReactNode;
};

export default function SupplierProvider({ children }: ExpenseProviderProps) {
  const [selectedRow, setSelectedRow] = useState<SupplierType>();
  const [suppliers, setSuppliers] = useState<SupplierType[]>();
  const [submitError, setSubmitError] = useState<string>();
  const [total, setTotal] = useState<number>();

  const value = {
    suppliers,
    setSuppliers,
    selectedRow,
    setSelectedRow,
    submitError,
    setSubmitError,
    total,
    setTotal,
  };

  return (
    <SupplierContext.Provider value={value}>
      {children}
    </SupplierContext.Provider>
  );
}
