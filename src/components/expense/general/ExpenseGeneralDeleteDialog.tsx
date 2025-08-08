import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogClose, DialogDescription } from "@radix-ui/react-dialog";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "../../ui/button";
import { useContext } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

export default function ExpenseGeneralDeleteDialog() {
  const {
    selectedGeneralEntry,
    openDeleteExpenseGeneralDialog,
    setOpenDeleteExpenseGeneralDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  async function deleteSupplier() {
    const supabase = createClient();

    if (!selectedGeneralEntry) return;

    const { error } = await supabase
      .from("expense_general")
      .delete()
      .eq("general_uuid", selectedGeneralEntry?.general_uuid);

    if (error) toast.error("ลบข้อมูลไม่สำเร็จ");
    else toast.success("ลบข้อมูลสำเร็จ");

    setOpenDeleteExpenseGeneralDialog(false);
  }

  return (
    <Dialog
      open={openDeleteExpenseGeneralDialog}
      onOpenChange={setOpenDeleteExpenseGeneralDialog}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Trash2 /> ลบบิล
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex flex-col gap-4">
          <DialogTitle>ยืนยันการลบข้อมูล</DialogTitle>
          <DialogDescription>
            เมื่อลบ ข้อมูลจะหายไปอย่างถาวรและไม่สามารถกู้คืนได้
          </DialogDescription>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={deleteSupplier}>
              <Check /> ตกลง
            </Button>
            <DialogClose asChild>
              <Button>
                <X /> ยกเลิก
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
