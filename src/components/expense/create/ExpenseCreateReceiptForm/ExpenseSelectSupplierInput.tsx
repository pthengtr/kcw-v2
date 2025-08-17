import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import PartySelect from "@/components/common/PartySelect";

export default function ExpenseSelectSupplierInput() {
  const { selectedSupplier, setSelectedSupplier, supplierFormError } =
    useContext(ExpenseContext) as ExpenseContextType;
  return (
    <PartySelect
      selectedParty={selectedSupplier}
      setSelectedParty={setSelectedSupplier}
      error={supplierFormError}
      kind="SUPPLIER"
    />
  );
}
