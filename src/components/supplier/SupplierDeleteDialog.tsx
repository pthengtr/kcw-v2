import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogClose, DialogDescription } from "@radix-ui/react-dialog";
import { Check, Trash, X } from "lucide-react";
import { Button } from "../ui/button";
import { useContext } from "react";
import { SupplierContext, SupplierContextType } from "./SupplierProvider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SupplierDeleteDialog() {
  const { selectedRow, openDeleteDialog, setOpenDeleteDialog } = useContext(
    SupplierContext
  ) as SupplierContextType;

  async function deleteSupplier() {
    const supabase = createClient();

    const { error } = await supabase
      .from("supplier")
      .delete()
      .eq("supplier_uuid", selectedRow?.supplier_uuid);

    if (error) toast.error("ลบข้อมูลไม่สำเร็จ");
    else toast.success("ลบข้อมูลสำเร็จ");

    setOpenDeleteDialog(false);
  }

  return (
    <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trash />
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
