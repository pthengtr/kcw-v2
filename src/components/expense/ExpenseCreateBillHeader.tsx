import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";

export default function ExpenseCreateBillHeader() {
  const { selectedSupplier } = useContext(ExpenseContext) as ExpenseContextType;

  return (
    <>
      {selectedSupplier ? (
        <div className={`flex gap-3 items-center text-lg`}>
          <div className="font-bold">{selectedSupplier.supplier_code}</div>
          <div>{selectedSupplier.supplier_name}</div>
        </div>
      ) : (
        "บิลค่าใช้จ่ายใหม่"
      )}
    </>
  );
}
