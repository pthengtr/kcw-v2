import React, { useContext } from "react";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Trash } from "lucide-react";
import { Button } from "../ui/button";
import {
  ReminderContext,
  ReminderContextType,
} from "../reminder/ReminderProvider";
import { BankInfoType } from "../reminder/ReminderColumn";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type BankInfoSavedAccountProps = {
  bankInfoList: BankInfoType[];
  setBankInfoList: (bankInfoList: BankInfoType[]) => void;
};

export default function BankInfoSavedAccount({
  bankInfoList,
  setBankInfoList,
}: BankInfoSavedAccountProps) {
  const { setSelectBankInfo, supplierName } = useContext(
    ReminderContext
  ) as ReminderContextType;

  const supabase = createClient();

  async function deleteBankInfo(id: string) {
    const { error } = await supabase
      .from("supplier_bank_info")
      .delete()
      .eq("id", id);

    if (error) {
      toast.success("ลบข้อมูลไม่สำเร็จ");
      return;
    }

    const { data, error: errorGetBankInfo } = await supabase
      .from("supplier_bank_info")
      .select("*", { count: "exact" })
      .ilike("supplier_code", supplierName)
      .order("id", { ascending: false })
      .limit(500);

    if (errorGetBankInfo) {
      console.log(error);
      return;
    }

    if (data) {
      setBankInfoList(data);
      console.log(data);
    }
  }

  function handleRadioBankInfoValueChange(bankInfoId: string) {
    setSelectBankInfo(
      bankInfoList?.find((bankInfo) => bankInfo.id === parseInt(bankInfoId))
    );
  }

  function handleDeleteBankInfo(id: string) {
    deleteBankInfo(id);
  }

  return (
    <RadioGroup
      className="grid grid-cols-2 p-2"
      onValueChange={handleRadioBankInfoValueChange}
    >
      {bankInfoList?.map((bankInfo) => (
        <React.Fragment key={`bank-info-${bankInfo.id}`}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={bankInfo.id.toString()}
              id={`bank-info-${bankInfo.id}`}
            />
            <Label htmlFor={`bank-info-${bankInfo.id}`}>
              <div className="flex flex-col gap-1">
                <span>{bankInfo.bank_account_name}</span>
                <div className="flex gap-3">
                  <span>{bankInfo.bank_name}</span>
                  <span>{bankInfo.bank_account_number}</span>
                </div>
              </div>
            </Label>
          </div>
          <Button
            className="justify-self-start"
            type="reset"
            onClick={() => handleDeleteBankInfo(bankInfo.id.toString())}
          >
            <Trash />
          </Button>
        </React.Fragment>
      ))}
    </RadioGroup>
  );
}
