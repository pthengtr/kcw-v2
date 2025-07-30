"use client";
import { createContext, useState } from "react";
import React from "react";
import { storageObjectType } from "../common/ImageCarousel";
import { ExpenseReceiptType } from "./summary/ExpenseReceiptColumn";
import { ExpenseEntryType } from "./summary/ExpenseEntryColumn";
import { ExpenseItemType } from "./create/ExpenseItemColumn";

export type ExpenseContextType = {
  openAddEntryDialog: boolean;
  setOpenAddEntryDialog: (open: boolean) => void;
  openUpdateEntryDialog: boolean;
  setOpenUpdateEntryDialog: (open: boolean) => void;
  openCreateVatReceiptDialog: boolean;
  setOpenCreateVatReceiptDialog: (open: boolean) => void;
  openCreateNoVatReceiptDialog: boolean;
  setOpenCreateNoVatReceiptDialog: (open: boolean) => void;

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
  createEntries: ExpenseEntryType[];
  setCreateEntries: (createEntries: ExpenseEntryType[]) => void;

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
  const [openAddEntryDialog, setOpenAddEntryDialog] = useState(false);
  const [openUpdateEntryDialog, setOpenUpdateEntryDialog] = useState(false);
  const [openCreateVatReceiptDialog, setOpenCreateVatReceiptDialog] =
    useState(false);
  const [openCreateNoVatReceiptDialog, setOpenCreateNoVatReceiptDialog] =
    useState(false);

  // select group
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceiptType>();
  const [selectedEntry, setSelectedEntry] = useState<ExpenseEntryType>();
  const [selectedItem, setSelectedItem] = useState<ExpenseItemType>();

  // array group
  const [expenseItems, setExpenseItems] = useState<ExpenseItemType[]>();
  const [expenseReceipts, setExpenseReceipts] =
    useState<ExpenseReceiptType[]>();
  const [receiptEntries, setReceiptEntries] = useState<ExpenseEntryType[]>();
  const [createEntries, setCreateEntries] = useState<ExpenseEntryType[]>([]);
  // total group
  const [totalReceipt, setTotalReceipt] = useState<number>();
  const [totalEntry, setTotalEntry] = useState<number>();
  const [totalItem, setTotalItem] = useState<number>();
  // image
  const [receiptImageArray, setReceiptImageArray] =
    useState<storageObjectType[]>();
  const [submitError, setSubmitError] = useState<string>();

  function handleSelectedReceipt(row: ExpenseReceiptType) {
    setSelectedReceipt(row);
  }

  const value = {
    openAddEntryDialog,
    setOpenAddEntryDialog,
    openUpdateEntryDialog,
    setOpenUpdateEntryDialog,
    openCreateVatReceiptDialog,
    setOpenCreateVatReceiptDialog,
    openCreateNoVatReceiptDialog,
    setOpenCreateNoVatReceiptDialog,

    //selected group
    selectedReceipt,
    setSelectedReceipt,
    selectedEntry,
    setSelectedEntry,
    selectedItem,
    setSelectedItem,

    // array group
    expenseReceipts,
    setExpenseReceipts,
    receiptEntries,
    setReceiptEntries,
    expenseItems,
    setExpenseItems,
    createEntries,
    setCreateEntries,

    // total group
    totalReceipt,
    setTotalReceipt,
    totalItem,
    setTotalItem,
    totalEntry,
    setTotalEntry,

    submitError,
    setSubmitError,
    receiptImageArray,
    setReceiptImageArray,
    handleSelectedReceipt,
  };

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
}
