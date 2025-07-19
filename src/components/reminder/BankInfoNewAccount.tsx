import { Input } from "../ui/input";
import SelectThaiBank from "./SelectThaiBank";
import { Checkbox } from "../ui/checkbox";
import { Label } from "@radix-ui/react-label";
import { useContext, useEffect } from "react";
import {
  ReminderContext,
  ReminderContextType,
} from "../reminder/ReminderProvider";

export default function BankInfoNewAccount() {
  const {
    bankAccountName,
    setBankAccountName,
    bankAccountNumber,
    setBankAccountNumber,
    saveBankInfo,
    setSaveBankInfo,
  } = useContext(ReminderContext) as ReminderContextType;

  useEffect(() => setSaveBankInfo(false), [setSaveBankInfo]);

  return (
    <div className="flex flex-col gap-3 py-4">
      <SelectThaiBank />
      <span className="text-sm">ชื่อบัญชี</span>
      <Input
        type="text"
        value={bankAccountName}
        onChange={(e) => setBankAccountName(e.target.value)}
      />
      <span className="text-sm">เลขบัญชี</span>
      <Input
        type="text"
        value={bankAccountNumber}
        onChange={(e) => setBankAccountNumber(e.target.value)}
      />
      <Label className="flex gap-4 items-center just">
        <Checkbox
          checked={saveBankInfo}
          onCheckedChange={(value) => setSaveBankInfo(value)}
        />
        <span>บันทึกบัญชีไว้ใช้ครั้งต่อไป</span>
      </Label>
    </div>
  );
}
