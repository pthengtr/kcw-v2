import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";
import { usePathname } from "next/navigation";

export default function ExpenseCreateBillHeader() {
  const { selectedSupplier } = useContext(ExpenseContext) as ExpenseContextType;

  const pathName = usePathname();

  return (
    <>
      {selectedSupplier ? (
        <div className={`flex gap-3 items-center text-lg`}>
          <div className="font-bold">{selectedSupplier.party_code}</div>
          <div>{selectedSupplier.party_name}</div>
        </div>
      ) : pathName.includes("/credit-note") ? (
        "ใบลดหนี้ใหม่"
      ) : (
        "บิลค่าใช้จ่ายใหม่"
      )}
    </>
  );
}
