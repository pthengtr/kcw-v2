import { useContext, useEffect } from "react";
import { FieldValues } from "react-hook-form";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import PartySelect from "../common/PartySelect";

type SupplierNameInputProps = {
  field: FieldValues;
};

export default function SupplierNameInput({ field }: SupplierNameInputProps) {
  const { selectedSupplier, setSelectedSupplier, setSupplierName } = useContext(
    ReminderContext
  ) as ReminderContextType;

  useEffect(() => {
    field.onChange(selectedSupplier?.party_code);
    if (selectedSupplier?.party_code)
      setSupplierName(selectedSupplier?.party_code);
  }, [field, selectedSupplier, setSupplierName]);

  return (
    <PartySelect
      selectedParty={selectedSupplier}
      setSelectedParty={setSelectedSupplier}
      kind="SUPPLIER"
    />
  );
}
