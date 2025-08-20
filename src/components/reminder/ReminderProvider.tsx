"use client";
import { createContext, useCallback, useState } from "react";
import React from "react";

import { CheckedState } from "@radix-ui/react-checkbox";
import {
  commonUploadFileProps,
  commonUploadFileReturn,
  sanitizeFilename,
  transliterateThaiConsonants,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PartyOption, PaymentReminderRow } from "@/lib/types/models";
import { PartyBankInfo } from "../party/PartyProvider";

export type ReminderContextType = {
  selectedRow: PaymentReminderRow | undefined;
  setSelectedRow: (selectedRow: PaymentReminderRow | undefined) => void;
  openCreateDialog: boolean;
  setOpenCreateDialog: (open: boolean) => void;
  openUpdateDialog: boolean;
  setOpenUpdateDialog: (open: boolean) => void;
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  reminders: PaymentReminderRow[] | undefined;
  setReminders: (reminders: PaymentReminderRow[]) => void;
  total: number | undefined;
  setTotal: (total: number) => void;
  bankName: string;
  setBankName: (bankName: string) => void;
  bankAccountName: string;
  setBankAccountName: (bankAccountName: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (bankAccountNumber: string) => void;
  handleSelectedRow: (row: PaymentReminderRow) => void;
  saveBankInfo: CheckedState;
  setSaveBankInfo: (saveBankInfo: CheckedState) => void;
  selectedBankInfo: PartyBankInfo | undefined;
  setSelectBankInfo: (selectedBankInfo: PartyBankInfo | undefined) => void;
  supplierName: string;
  setSupplierName: (supplierName: string) => void;
  selectedSupplier: PartyOption | undefined;
  setSelectedSupplier: (selectedSupplier: PartyOption | undefined) => void;
  isAdmin: boolean;
  setIsAdmin: (open: boolean) => void;
  reminderUploadFile: ({
    picture,
    imageId,
    imageFolder,
  }: commonUploadFileProps) => commonUploadFileReturn;
  getReminder: () => void;
  status: string;
  setStatus: (status: string) => void;
  updateSelectedRow?: (patch: Partial<PaymentReminderRow>) => void; // NEW
};

export const ReminderContext = createContext<ReminderContextType | null>(null);

type ReminderProvider = {
  children: React.ReactNode;
};

export default function ReminderProvider({ children }: ReminderProvider) {
  const [selectedRow, setSelectedRow] = useState<PaymentReminderRow>();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [reminders, setReminders] = useState<PaymentReminderRow[]>();
  const [total, setTotal] = useState<number>();
  const [bankName, setBankName] = useState<string>("");
  const [bankAccountName, setBankAccountName] = useState<string>("");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>("");
  const [saveBankInfo, setSaveBankInfo] = useState<CheckedState>(false);
  const [selectedBankInfo, setSelectBankInfo] = useState<PartyBankInfo>();
  const [supplierName, setSupplierName] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<PartyOption>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("all");

  function handleSelectedRow(row: PaymentReminderRow) {
    setSelectedRow(row);
  }

  const updateSelectedRow = useCallback(
    (patch: Partial<PaymentReminderRow>) => {
      setSelectedRow((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    []
  );
  const getReminder = useCallback(
    async function () {
      const supabase = createClient();
      let query = supabase
        .from("payment_reminder")
        .select("*, party(*)", { count: "exact" })
        .order("created_at", { ascending: false })
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
        .eq("reminder_uuid", selectedRow.reminder_uuid)
        .select();

      if (errorUpdate) console.log(errorUpdate);
      if (dataUpdate) {
        console.log(dataUpdate);
        getReminder();
      }
    }

    return { data };
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
    selectedSupplier,
    setSelectedSupplier,
    isAdmin,
    setIsAdmin,
    reminderUploadFile,
    getReminder,
    setStatus,
    status,
    updateSelectedRow,
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
}
