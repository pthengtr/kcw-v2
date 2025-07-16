import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FieldValues } from "react-hook-form";

const thaiBanks = [
  { value: "scb", label: "ธนาคารไทยพาณิชย์" },
  { value: "ktb", label: "ธนาคารกรุงไทย" },
  { value: "bbl", label: "ธนาคารกรุงเทพ" },
  { value: "gsb", label: "ธนาคารออมสิน" },
  { value: "tmb", label: "ธนาคารทหารไทย" },
  { value: "uob", label: "UOB Bank (Thailand)" },
  { value: "baac", label: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
  { value: "citi", label: "ซิตี้แบงก์" },
  { value: "kcc", label: "ธนาคารเกียรตินาคิน" },
  { value: "kbank", label: "ธนาคารกสิกรไทย" },
  { value: "lh", label: "ธนาคารแลนด์ แอนด์ เฮาส์" },
  { value: "tisco", label: "ธนาคารทิสโก้" },
  { value: "icbc", label: "ธนาคารไอซีบีซีไทย" },
  { value: "cimb", label: "ธนาคารซีไอเอ็มบี ไทย" },
  { value: "afb", label: "ธนาคารอาคารสงเคราะห์" },
  // Add more if needed
];

type SelectThaiBankProps = {
  field: FieldValues;
};

export default function SelectThaiBank({ field }: SelectThaiBankProps) {
  console.log(field.value);
  return (
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
  );
}
