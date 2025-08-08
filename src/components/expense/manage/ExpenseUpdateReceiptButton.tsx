import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { UUID } from "@/lib/types/models";

type ExpenseUpdateReceiptButtonProps = {
  receipt_uuid: UUID;
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
};

export default function ExpenseUpdateReceiptButton({
  receipt_uuid,
  size = "default",
}: ExpenseUpdateReceiptButtonProps) {
  const { branch } = useParams();
  const router = useRouter();

  function handleUpdateReceipt() {
    router.push(
      `/expense/company/${branch}/update-receipt?receipt-id=${receipt_uuid}`
    );
  }
  return (
    <>
      <Button variant="outline" size={size} onClick={handleUpdateReceipt}>
        <Pencil /> แก้ไขบิลนี้
      </Button>
    </>
  );
}
