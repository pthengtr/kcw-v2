"use client";
import { createContext, useState } from "react";
import React from "react";
import { BankInfoType, ReminderType } from "./ReminderColumn";
import { CheckedState } from "@radix-ui/react-checkbox";
import { storageObjectType } from "../common/ImageCarousel";

export type ReminderContextType = {
  selectedRow: ReminderType | undefined;
  setSelectedRow: (selectedRow: ReminderType | undefined) => void;
  openCreateDialog: boolean;
  setOpenCreateDialog: (open: boolean) => void;
  openUpdateDialog: boolean;
  setOpenUpdateDialog: (open: boolean) => void;
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  reminders: ReminderType[] | undefined;
  setReminders: (reminders: ReminderType[]) => void;
  total: number | undefined;
  setTotal: (total: number) => void;
  bankName: string;
  setBankName: (bankName: string) => void;
  bankAccountName: string;
  setBankAccountName: (bankAccountName: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (bankAccountNumber: string) => void;
  handleSelectedRow: (row: ReminderType) => void;
  saveBankInfo: CheckedState;
  setSaveBankInfo: (saveBankInfo: CheckedState) => void;
  selectedBankInfo: BankInfoType | undefined;
  setSelectBankInfo: (selectedBankInfo: BankInfoType | undefined) => void;
  supplierName: string;
  setSupplierName: (supplierName: string) => void;
  billImageArray: storageObjectType[] | undefined;
  setBillImageArray: (billImageArray: storageObjectType[] | undefined) => void;
  paymentImageArray: storageObjectType[] | undefined;
  setPaymentImageArray: (
    paymentImageArray: storageObjectType[] | undefined
  ) => void;
  isAdmin: boolean;
  setIsAdmin: (open: boolean) => void;
};

export const ReminderContext = createContext<ReminderContextType | null>(null);

type ReminderProvider = {
  children: React.ReactNode;
};

export default function ReminderProvider({ children }: ReminderProvider) {
  const [selectedRow, setSelectedRow] = useState<ReminderType>();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [reminders, setReminders] = useState<ReminderType[]>();
  const [total, setTotal] = useState<number>();
  const [bankName, setBankName] = useState<string>("");
  const [bankAccountName, setBankAccountName] = useState<string>("");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");
  const [saveBankInfo, setSaveBankInfo] = useState<CheckedState>(false);
  const [selectedBankInfo, setSelectBankInfo] = useState<BankInfoType>();
  const [supplierName, setSupplierName] = useState("");
  const [billImageArray, setBillImageArray] = useState<storageObjectType[]>();
  const [paymentImageArray, setPaymentImageArray] =
    useState<storageObjectType[]>();
  const [isAdmin, setIsAdmin] = useState(false);

  function handleSelectedRow(row: ReminderType) {
    setSelectedRow(row);
    setSupplierName(row.supplier_code);
    setBankName(row.bank_name);
    setBankAccountName(row.bank_account_name);
    setBankAccountNumber(row.bank_account_number);
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
    reminders,
    setReminders,
    total,
    setTotal,
    bankName,
    setBankName,
    bankAccountName,
    setBankAccountName,
    bankAccountNumber,
    setBankAccountNumber,
    handleSelectedRow,
    saveBankInfo,
    setSaveBankInfo,
    selectedBankInfo,
    setSelectBankInfo,
    supplierName,
    setSupplierName,
    billImageArray,
    setBillImageArray,
    paymentImageArray,
    setPaymentImageArray,
    isAdmin,
    setIsAdmin,
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
}
