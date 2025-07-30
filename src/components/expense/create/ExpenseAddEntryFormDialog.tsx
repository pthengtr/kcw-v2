import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpenseAddEntryForm, {
  ExpenseAddEntryFormDefaultType,
  expenseAddEntryFormDefaultValues,
} from "./ExpenseAddEntryForm";

type ExpenseAddEntryFormDialogProps = {
  update?: boolean;
};

export default function ExpenseAddEntryFormDialog({
  update = false,
}: ExpenseAddEntryFormDialogProps) {
  const {
    openAddEntryDialog,
    setOpenAddEntryDialog,
    openUpdateEntryDialog,
    setOpenUpdateEntryDialog,
    selectedEntry,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const defaultValues: ExpenseAddEntryFormDefaultType =
    update && selectedEntry
      ? {
          entry_detail: selectedEntry.entry_detail,
          unit_price: selectedEntry.unit_price,
          quantity: selectedEntry.quantity,
        }
      : expenseAddEntryFormDefaultValues;

  return (
    <Dialog
      open={update ? openUpdateEntryDialog : openAddEntryDialog}
      onOpenChange={update ? setOpenUpdateEntryDialog : setOpenAddEntryDialog}
    >
      <DialogTrigger asChild>
        <Button>
          {update ? (
            <>
              <Pencil /> แก้ไข
            </>
          ) : (
            <>
              <Plus /> เพิ่ม
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex flex-col gap-4">
          <DialogTitle>{update ? "แก้ไขรายการ" : "เพิ่มรายการ"}</DialogTitle>
          <ExpenseAddEntryForm defaultValues={defaultValues} update={update} />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
