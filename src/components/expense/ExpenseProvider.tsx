"use client";
import { createContext, useState } from "react";
import React from "react";
import { storageObjectType } from "../common/ImageCarousel";
import { ExpenseType } from "./ExpenseColumn";

export type ExpenseContextType = {
  selectedRow: ExpenseType | undefined;
  setSelectedRow: (selectedRow: ExpenseType | undefined) => void;
  openCreateDialog: boolean;
  setOpenCreateDialog: (open: boolean) => void;
  openUpdateDialog: boolean;
  setOpenUpdateDialog: (open: boolean) => void;
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  expenses: ExpenseType[] | undefined;
  setExpenses: (expenses: ExpenseType[]) => void;
  total: number | undefined;
  setTotal: (total: number) => void;
  handleSelectedRow: (row: ExpenseType) => void;
  receiptImageArray: storageObjectType[] | undefined;
  setReceiptImageArray: (
    receiptImageArray: storageObjectType[] | undefined
  ) => void;
};

export const ExpenseContext = createContext<ExpenseContextType | null>(null);

type ExpenseProviderProps = {
  children: React.ReactNode;
};

export default function ExpenseProvider({ children }: ExpenseProviderProps) {
  const [selectedRow, setSelectedRow] = useState<ExpenseType>();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [expenses, setExpenses] = useState<ExpenseType[]>();
  const [total, setTotal] = useState<number>();
  const [receiptImageArray, setReceiptImageArray] =
    useState<storageObjectType[]>();

  function handleSelectedRow(row: ExpenseType) {
    setSelectedRow(row);
  }

  const value = {
    selectedRow,
    setSelectedRow,
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setOpenUpdateDialog,
    submitError,
    setSubmitError,
    expenses,
    setExpenses,
    total,
    setTotal,
    receiptImageArray,
    setReceiptImageArray,
    handleSelectedRow,
  };

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
}
