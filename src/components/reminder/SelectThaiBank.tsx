import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "../ui/button";
import { Trash } from "lucide-react";
import {
  ReminderContext,
  ReminderContextType,
} from "../reminder/ReminderProvider";
import { useContext } from "react";

const thaiBanks = [
  { value: "scb", label: "ไทยพาณิชย์" }, // 1. SCB
  { value: "ktb", label: "กรุงไทย" }, // 2. KTB
  { value: "bbl", label: "กรุงเทพ" }, // 3. BBL
  { value: "kbank", label: "กสิกรไทย" }, // 4. KBank
  { value: "krungsri", label: "กรุงศรีอยุธยา" },
  { value: "tmb", label: "ทหารไทย" }, // 5. TMB
  { value: "uob", label: "UOB Bank (Thailand)" }, // 6. UOB
  { value: "gsb", label: "ออมสิน" }, // 7. GSB
  { value: "citi", label: "ซิตี้แบงก์" }, // 8. Citi
  { value: "cimb", label: "ซีไอเอ็มบี ไทย" }, // 9. CIMB
  { value: "icbc", label: "ไอซีบีซีไทย" }, // 10. ICBC
  { value: "afb", label: "อาคารสงเคราะห์" }, // 11. Bank of GHT
  { value: "kcc", label: "เกียรตินาคิน" }, // 12. Kiatnakin
  { value: "lh", label: "แลนด์ แอนด์ เฮาส์" }, // 13. LH Bank
  { value: "tisco", label: "ทิสโก้" }, // 14. Tisco
  { value: "baac", label: "ธ.ก.ส." },
  // Add more if needed
];

export default function SelectThaiBank() {
  const { bankName, setBankName } = useContext(
    ReminderContext
  ) as ReminderContextType;

  return (
    <>
      <span className="text-sm">ธนาคาร</span>
      <div className="flex gap-3">
        <Select value={bankName} onValueChange={setBankName}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="เลือกธนาคาร" />
          </SelectTrigger>
          <SelectContent>
            {thaiBanks.map((bank) => (
              <SelectItem key={bank.value} value={bank.label}>
                {bank.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="reset" onClick={() => setBankName("")}>
          <Trash />
        </Button>
      </div>
    </>
  );
}
