import { useContext } from "react";
import { FieldValues } from "react-hook-form";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ControlInputText from "../common/ControlInputText";

type SupplierNameInputProps = {
  field: FieldValues;
};
export default function SupplierNameInput({ field }: SupplierNameInputProps) {
  const { supplierName, setSupplierName } = useContext(
    ReminderContext
  ) as ReminderContextType;

  return (
    <ControlInputText
      field={field}
      value={supplierName}
      setValue={setSupplierName}
    />
  );
}
