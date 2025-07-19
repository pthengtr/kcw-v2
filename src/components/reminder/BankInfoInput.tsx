"use client";
import React, { useContext, useEffect, useState } from "react";
import {
  ReminderContext,
  ReminderContextType,
} from "../reminder/ReminderProvider";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BankInfoNewAccount from "./BankInfoNewAccount";
import { createClient } from "@/lib/supabase/client";
import { BankInfoType } from "../reminder/ReminderColumn";
import BankInfoSavedAccount from "./BankInfoSavedAccount";
import { Separator } from "../ui/separator";

export default function BankInfoInput() {
  const {
    setSelectBankInfo,
    setBankAccountName,
    setBankAccountNumber,
    setBankName,
    openCreateDialog,
    openUpdateDialog,
    supplierName,
    setSupplierName,
  } = useContext(ReminderContext) as ReminderContextType;

  const [bankInfoList, setBankInfoList] = useState<
    BankInfoType[] | undefined
  >();

  const supabase = createClient();

  async function getBankInfo() {
    const { data, error } = await supabase
      .from("supplier_bank_info")
      .select("*", { count: "exact" })
      .ilike("supplier_name", supplierName)
      .order("id", { ascending: false })
      .limit(500);

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setBankInfoList(data);
      console.log(data);
    }
  }

  const [tab, setTab] = useState("new_account");

  useEffect(() => {
    if (!openUpdateDialog) {
      console.log("clear data");
      setBankName("");
      setBankAccountName("");
      setBankAccountNumber("");
      setSupplierName("");
    }
    setSelectBankInfo(undefined);
  }, [
    openUpdateDialog,
    openCreateDialog,
    setBankAccountName,
    setBankAccountNumber,
    setBankName,
    setSelectBankInfo,
    setSupplierName,
  ]);

  function handleTabChange(tab: string) {
    if (tab === "existing_account") {
      getBankInfo();
    } else {
      setBankInfoList(undefined);
    }
    setTab(tab);
  }

  console.log(bankInfoList);

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="w-full border p-2 rounded-lg"
      >
        <TabsList className="mb-2">
          <TabsTrigger value="new_account">บัญชีไหม่</TabsTrigger>
          <TabsTrigger value="existing_account">บัญชีที่บันทึกไว้</TabsTrigger>
        </TabsList>
        <Separator />
        <TabsContent value="new_account">
          <BankInfoNewAccount />
        </TabsContent>
        <TabsContent value="existing_account">
          {bankInfoList && bankInfoList.length > 0 ? (
            <BankInfoSavedAccount
              bankInfoList={bankInfoList}
              setBankInfoList={setBankInfoList}
            />
          ) : (
            <div className="px-2 py-4">ไม่พบข้อมูลที่บันทึกไว้</div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
