import { FieldValues } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useId } from "react";

type ExpenseTypeInputProps = {
  field: FieldValues;
};

const expenseGroupLabel = [
  "ค่าใช้จ่ายในการดำเนินการ",
  "ค่าใช้จ่ายอื่นๆ",
  "ค่าใช้จ่ายส่วนตัวกรรมการ",
  "เจ้าหนี้สรรพากร",
];
const expenseGroup = [
  // group
  [
    { value: "เงินเดือน", label: "เงินเดือน" },
    { value: "ค่าอุปกรณ์สำนักงาน", label: "ค่าอุปกรณ์สำนักงาน" },
    { value: "ค่าโทรศัพท์", label: "ค่าโทรศัพท์" },
    { value: "ค่าปะปา", label: "ค่าปะปา" },
    { value: "ค่าน้ำมัน", label: "ค่าน้ำมัน" },
    { value: "ค่าบำรุงรักษา", label: "ค่าบำรุงรักษา" },
    { value: "สื่อโฆษณา", label: "สื่อโฆษณา" },
    { value: "ค่าขนส่ง", label: "ค่าขนส่ง" },
    { value: "ค่าไฟ", label: "ค่าไฟ" },
    { value: "ค่าไปรษณีย์", label: "ค่าไปรษณีย์" },
    { value: "ค่าใช้จ่ายเบ็ดเตล็ด", label: "ค่าใช้จ่ายเบ็ดเตล็ด" },
    { value: "ค่าเช่า", label: "ค่าเช่า" },
    { value: "อะไหล่ซ่อม", label: "อะไหล่ซ่อม" },
    { value: "ค่าประกันภัย", label: "ค่าประกันภัย" },
    { value: "ภาษีที่ดิน", label: "ภาษีที่ดิน" },
    { value: "ภาษีป้าย", label: "ภาษีป้าย" },
    { value: "ค่าทำบัญชี ", label: "ค่าทำบัญชี " },
    { value: "เงินประกันสังคม", label: "เงินประกันสังคม" },
    { value: "ค่าอาหารพนักงาน", label: "ค่าอาหารพนักงาน" },
    { value: "ค่าธรรมเนียมขาย ออนไลน์", label: "ค่าธรรมเนียมขาย ออนไลน์" },
  ],
  // group
  [
    { value: "ดอกเบี้ยจ่าย", label: "ดอกเบี้ยจ่าย" },
    { value: "ค่าธรรมเนียมธนาคาร", label: "ค่าธรรมเนียมธนาคาร" },
  ],
  // group
  [
    { value: "ค่ารักษาพยาบาลกรรมการ", label: "ค่ารักษาพยาบาลกรรมการ" },
    { value: "ค่าอาหารกรรมการ", label: "ค่าอาหารกรรมการ" },
    { value: "ค่าประกันชีวิตกรรมการ AIA", label: "ค่าประกันชีวิตกรรมการ AIA" },
    {
      value: "ค่าใช้จ่ายเบ็ดเตล็ด กรรมการ",
      label: "ค่าใช้จ่ายเบ็ดเตล็ด กรรมการ",
    },
  ],
  // group
  [
    { value: "ภพ. 30 VAT", label: "ภพ. 30 VAT" },
    { value: "ภงด. 1-3-53", label: "ภงด. 1-3-53" },
    { value: "ภงด. 50 51", label: "ภงด. 50 51" },
  ],
];

export default function ExpenseTypeInput({ field }: ExpenseTypeInputProps) {
  const id = useId();
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="เลือกประเภทบัญชี" />
      </SelectTrigger>
      <SelectContent>
        {expenseGroupLabel.map((group, index) => (
          <SelectGroup key={`${id}-${expenseGroupLabel[index]}`}>
            <SelectLabel>{expenseGroupLabel[index]}</SelectLabel>
            {expenseGroup[index].map((item) => (
              <SelectItem key={`item-${id}-${item.value}`} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
