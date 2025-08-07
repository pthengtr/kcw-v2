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
import { SupplierContext, SupplierContextType } from "../SupplierProvider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SupplierTaxPayerDeleteDialog() {
  const {
    selectedRow,
    openDeleteTaxFormDialog,
    setOpenDeleteTaxFormDialog,
    setSelectedRow,
    getSuppliers,
  } = useContext(SupplierContext) as SupplierContextType;

  async function deleteSupplier() {
    if (!selectedRow) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("supplier_tax_info")
      .delete()
      .eq("supplier_uuid", selectedRow.supplier_uuid);

    if (error) toast.error("ลบข้อมูลไม่สำเร็จ");
    else {
      const newSelectedRow = { ...selectedRow, supplier_tax_info: undefined };
      setSelectedRow(newSelectedRow);
      getSuppliers();
      toast.success("ลบข้อมูลสำเร็จ");
    }
    setOpenDeleteTaxFormDialog(false);
  }

  return (
    <Dialog
      open={openDeleteTaxFormDialog}
      onOpenChange={setOpenDeleteTaxFormDialog}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Trash2 />
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
