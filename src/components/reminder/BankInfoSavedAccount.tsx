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

  async function deleteBankInfo(uuid: string) {
    const { error } = await supabase
      .from("supplier_bank_info")
      .delete()
      .eq("bank_info_uuid", uuid);

    if (error) {
      toast.success("ลบข้อมูลไม่สำเร็จ");
      return;
    }

    const { data, error: errorGetBankInfo } = await supabase
      .from("supplier_bank_info")
      .select("*", { count: "exact" })
      .ilike("supplier_code", supplierName)
      .order("bank_name", { ascending: false })
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

  function handleRadioBankInfoValueChange(bankInfoUuid: string) {
    setSelectBankInfo(
      bankInfoList?.find((bankInfo) => bankInfo.bank_info_uuid === bankInfoUuid)
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
        <React.Fragment key={`bank-info-${bankInfo.bank_info_uuid}`}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={bankInfo.bank_info_uuid.toString()}
              id={`bank-info-${bankInfo.bank_info_uuid}`}
            />
            <Label htmlFor={`bank-info-${bankInfo.bank_info_uuid}`}>
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
            onClick={() => handleDeleteBankInfo(bankInfo.bank_info_uuid)}
          >
            <Trash />
          </Button>
        </React.Fragment>
      ))}
    </RadioGroup>
  );
}
