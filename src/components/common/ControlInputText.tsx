import { ChangeEvent } from "react";
import { Input } from "../ui/input";
import { FieldValues } from "react-hook-form";

type ControlInputTextProps = {
  field: FieldValues;
  value: string;
  setValue: (value: string) => void;
};

export default function ControlInputText({
  field,
  value,
  setValue,
}: ControlInputTextProps) {
  function handleOnchange(e: ChangeEvent<HTMLInputElement>) {
    field.onChange(e.target.value);
    setValue(e.target.value);
  }
  return (
    <Input type="text" value={value} onChange={(e) => handleOnchange(e)} />
  );
}
