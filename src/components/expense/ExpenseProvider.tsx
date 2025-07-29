"use client";
import { createContext, useState } from "react";
import React from "react";
import { storageObjectType } from "../common/ImageCarousel";
import { ExpenseReceiptType } from "./summary/ExpenseReceiptColumn";
import { ExpenseEntryType } from "./summary/ExpenseEntryColumn";
import { ExpenseItemType } from "./create/ExpenseItemColumn";

export type ExpenseContextType = {
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  handleSelectedReceipt: (row: ExpenseReceiptType) => void;
  receiptImageArray: storageObjectType[] | undefined;
  setReceiptImageArray: (
    receiptImageArray: storageObjectType[] | undefined
  ) => void;

  // set selected group
  selectedReceipt: ExpenseReceiptType | undefined;
  setSelectedReceipt: (selectedRow: ExpenseReceiptType | undefined) => void;
  selectedEntry: ExpenseEntryType | undefined;
  setSelectedEntry: (selectedRow: ExpenseEntryType | undefined) => void;
  selectedItem: ExpenseItemType | undefined;
  setSelectedItem: (selectedRow: ExpenseItemType | undefined) => void;

  // array group
  expenseReceipts: ExpenseReceiptType[] | undefined;
  setExpenseReceipts: (expenses: ExpenseReceiptType[]) => void;
  receiptEntries: ExpenseEntryType[] | undefined;
  setReceiptEntries: (receiptEntries: ExpenseEntryType[] | undefined) => void;
  expenseItems: ExpenseItemType[] | undefined;
  setExpenseItems: (expenseItems: ExpenseItemType[] | undefined) => void;

  // total group
  totalReceipt: number | undefined;
  setTotalReceipt: (total: number) => void;
  totalEntry: number | undefined;
  setTotalEntry: (total: number) => void;
  totalItem: number | undefined;
  setTotalItem: (total: number) => void;
};

export const ExpenseContext = createContext<ExpenseContextType | null>(null);

type ExpenseProviderProps = {
  children: React.ReactNode;
};

export default function ExpenseProvider({ children }: ExpenseProviderProps) {
  const [submitError, setSubmitError] = useState<string>();
  // select group
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceiptType>();
  const [selectedEntry, setSelectedEntry] = useState<ExpenseEntryType>();
  const [selectedItem, setSelectedItem] = useState<ExpenseItemType>();
  // array group
  const [expenseItems, setExpenseItems] = useState<ExpenseItemType[]>();
  const [expenseReceipts, setExpenseReceipts] =
    useState<ExpenseReceiptType[]>();
  const [receiptEntries, setReceiptEntries] = useState<ExpenseEntryType[]>();
  // total group
  const [totalReceipt, setTotalReceipt] = useState<number>();
  const [totalEntry, setTotalEntry] = useState<number>();
  const [totalItem, setTotalItem] = useState<number>();
  // image
  const [receiptImageArray, setReceiptImageArray] =
    useState<storageObjectType[]>();

  function handleSelectedReceipt(row: ExpenseReceiptType) {
    setSelectedReceipt(row);
  }

  const value = {
    selectedReceipt,
    setSelectedReceipt,
    selectedEntry,
    setSelectedEntry,
    selectedItem,
    setSelectedItem,
    submitError,
    setSubmitError,
    expenseReceipts,
    setExpenseReceipts,
    receiptEntries,
    setReceiptEntries,
    expenseItems,
    setExpenseItems,
    totalReceipt,
    setTotalReceipt,
    totalItem,
    setTotalItem,
    totalEntry,
    setTotalEntry,
    receiptImageArray,
    setReceiptImageArray,
    handleSelectedReceipt,
  };

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
}
