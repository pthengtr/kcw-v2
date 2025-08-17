"use client";
import { createContext, useCallback, useState } from "react";
import React from "react";
import { BankInfoType, ReminderType } from "./ReminderColumn";
import { CheckedState } from "@radix-ui/react-checkbox";
import { storageObjectType } from "../common/ImageCarousel";
import {
  commonUploadFileProps,
  commonUploadFileReturn,
  sanitizeFilename,
  transliterateThaiConsonants,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PartyOption } from "@/lib/types/models";

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
  selectedSupplier: PartyOption | undefined;
  setSelectedSupplier: (selectedSupplier: PartyOption | undefined) => void;
  billImageArray: storageObjectType[] | undefined;
  setBillImageArray: (billImageArray: storageObjectType[] | undefined) => void;
  paymentImageArray: storageObjectType[] | undefined;
  setPaymentImageArray: (
    paymentImageArray: storageObjectType[] | undefined
  ) => void;
  isAdmin: boolean;
  setIsAdmin: (open: boolean) => void;
  reminderUploadFile: ({
    picture,
    imageId,
    imageFolder,
  }: commonUploadFileProps) => commonUploadFileReturn;
  getReminder: () => void;
  reminderGetImageArray: (
    imageFolder: string,
    imageId: string,
    setImageArray: (imageArray: storageObjectType[]) => void
  ) => void;
  status: string;
  setStatus: (status: string) => void;
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
  const [selectedSupplier, setSelectedSupplier] = useState<PartyOption>();
  const [billImageArray, setBillImageArray] = useState<storageObjectType[]>();
  const [paymentImageArray, setPaymentImageArray] =
    useState<storageObjectType[]>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("all");

  function handleSelectedRow(row: ReminderType) {
    setSelectedRow(row);
    setSupplierName(row.supplier_code);
    setBankName(row.bank_name);
    setBankAccountName(row.bank_account_name);
    setBankAccountNumber(row.bank_account_number);
  }

  const getReminder = useCallback(
    async function () {
      const supabase = createClient();
      let query = supabase
        .from("payment_reminder")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .limit(500);

      if (status === "paid") query = query.not("payment_date", "is", "null");
      else if (status === "unpaid") query = query.is("payment_date", null);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        console.log(data);
        setReminders(data);
      }
      if (count !== null && count !== undefined) setTotal(count);
    },
    [status]
  );

  async function reminderUploadFile({
    picture,
    imageId,
    imageFolder,
  }: commonUploadFileProps): commonUploadFileReturn {
    const safeImageId = transliterateThaiConsonants(imageId);

    const temp_imageFilename =
      safeImageId +
      "_" +
      Math.random().toString().substring(4, 12) +
      "." +
      sanitizeFilename(picture.name).split(".")[1];

    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("pictures")
      .upload(`public/${imageFolder}/${temp_imageFilename}`, picture);

    if (!!error) {
      console.log(error);
      toast.error(`เกิดข้อผิดพลาด ไม่สามารถอัพโหลด ${picture.name}`);
    }

    if (!!data && imageFolder === "reminder_payment" && selectedRow) {
      const { data: dataUpdate, error: errorUpdate } = await supabase
        .from("payment_reminder")
        .update({ proof_of_payment: true })
        .eq("id", selectedRow.id)
        .select();

      if (errorUpdate) console.log(errorUpdate);
      if (dataUpdate) {
        console.log(dataUpdate);
        getReminder();
      }
    }

    return { data };
  }

  const reminderGetImageArray = useCallback(
    async function (
      imageFolder: string,
      imageId: string,
      setImageArray: (imageArray: storageObjectType[]) => void
    ) {
      const safeImageId = transliterateThaiConsonants(imageId);

      const supabase = createClient();

      const { data, error } = await supabase.storage
        .from("pictures")
        .list(`public/${imageFolder}`, {
          limit: 100,
          offset: 0,
          search: safeImageId,
          sortBy: { column: "updated_at", order: "asc" },
        });

      if (!!error) console.log(error);
      if (!!data) {
        if (
          data.length === 0 &&
          imageFolder === "reminder_payment" &&
          selectedRow
        ) {
          const { data: dataUpdate, error: errorUpdate } = await supabase
            .from("payment_reminder")
            .update({ proof_of_payment: false })
            .eq("id", selectedRow.id)
            .select();

          if (errorUpdate) console.log(errorUpdate);
          if (dataUpdate) {
            console.log(dataUpdate);
            getReminder();
          }
        }
        setImageArray(data);
        //setCount(data.length + 1);
      }
    },
    [getReminder, selectedRow]
  );

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
    selectedSupplier,
    setSelectedSupplier,
    billImageArray,
    setBillImageArray,
    paymentImageArray,
    setPaymentImageArray,
    isAdmin,
    setIsAdmin,
    reminderUploadFile,
    getReminder,
    setStatus,
    status,
    reminderGetImageArray,
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
}
