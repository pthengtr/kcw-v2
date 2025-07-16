import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FieldValues } from "react-hook-form";
import { Button } from "../ui/button";
import { Trash } from "lucide-react";

const thaiBanks = [
  { value: "scb", label: "ไทยพาณิชย์" }, // 1. SCB
  { value: "ktb", label: "กรุงไทย" }, // 2. KTB
  { value: "bbl", label: "กรุงเทพ" }, // 3. BBL
  { value: "kbank", label: "กสิกรไทย" }, // 4. KBank
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
  { value: "baac", label: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
  // Add more if needed
];

type SelectThaiBankProps = {
  field: FieldValues;
};

export default function SelectThaiBank({ field }: SelectThaiBankProps) {
  return (
    <div className="flex gap-3">
      <Select value={field.value} onValueChange={field.onChange}>
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
      <Button type="reset" onClick={() => field.onChange("")}>
        <Trash />
      </Button>
    </div>
  );
}
