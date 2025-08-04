import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { useContext } from "react";

export default function ExpenseUpdateReceiptButton() {
  const { selectedReceipt } = useContext(ExpenseContext) as ExpenseContextType;
  const { branch } = useParams();
  const router = useRouter();

  function handleUpdateReceipt() {
    router.push(
      `/expense/${branch}/update-receipt?receipt-id=${selectedReceipt?.receipt_uuid}`
    );
  }
  return (
    <>
      <Button variant="outline" onClick={handleUpdateReceipt}>
        <Pencil /> แก้ไขบิลนี้
      </Button>
    </>
  );
}
