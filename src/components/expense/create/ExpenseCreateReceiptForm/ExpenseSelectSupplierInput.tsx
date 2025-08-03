import CommonSupplierNameInput from "@/components/common/CommonSupplierNameInput";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

export default function ExpenseSelectSupplierInput() {
  const { selectedSupplier, setSelectedSupplier } = useContext(
    ExpenseContext
  ) as ExpenseContextType;
  return (
    <CommonSupplierNameInput
      selectedSupplier={selectedSupplier}
      setSelectedSupplier={setSelectedSupplier}
    />
  );
}
