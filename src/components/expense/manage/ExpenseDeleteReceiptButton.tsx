import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Trash2, X } from "lucide-react";
import { useContext, useState } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { UUID } from "@/lib/types/models";

export default function ExpenseDeleteReceiptButton() {
  const [open, setOpen] = useState(false);
  const { selectedReceipt, setSelectedReceipt, setReceiptEntries, getExpense } =
    useContext(ExpenseContext) as ExpenseContextType;

  const { branch }: { branch: UUID } = useParams();

  async function handleDeleteReceipt() {
    if (!selectedReceipt) return;

    const supabase = createClient();

    const { data: entriesDeleted, error: errorDeleteEntriese } = await supabase
      .from("expense_entry")
      .delete()
      .eq("receipt_uuid", selectedReceipt.receipt_uuid);

    if (errorDeleteEntriese) {
      console.log(errorDeleteEntriese.message);
      toast.error(errorDeleteEntriese.message);
    }

    if (entriesDeleted) {
      console.log(entriesDeleted);
    }

    const { data: receiptDeleted, error: errorDeleteReceipt } = await supabase
      .from("expense_receipt")
      .delete()
      .eq("receipt_uuid", selectedReceipt.receipt_uuid);

    if (errorDeleteReceipt) {
      console.log(errorDeleteReceipt.message);
      toast.error(errorDeleteReceipt.message);
    }

    if (receiptDeleted) {
      console.log(entriesDeleted);
      toast.success("ลบบิลสำเร็จ");
    }

    getExpense(branch);
    setSelectedReceipt(undefined);
    setReceiptEntries([]);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 /> ลบบิลนี้
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>คุณแน่ใจหรือไม่?</DialogTitle>
          </DialogHeader>
          <DialogDescription>การลบนี้ไม่สามารถย้อนกลับได้</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X /> ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDeleteReceipt();
                setOpen(false);
              }}
            >
              <Trash2 />
              ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
