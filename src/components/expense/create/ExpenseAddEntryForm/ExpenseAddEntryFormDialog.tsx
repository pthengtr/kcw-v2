import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FilePlus2, Pencil } from "lucide-react";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
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
          item_uuid: selectedEntry.item_uuid,
          entry_detail: selectedEntry.entry_detail,
          unit_price: selectedEntry.unit_price,
          includeVat: false,
          quantity: selectedEntry.quantity,
          discount: selectedEntry.discount,
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
              <Pencil />
            </>
          ) : (
            <>
              <FilePlus2 /> เพิ่มรายการในบิล
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex flex-col gap-2">
          <DialogTitle>{update ? "แก้ไขรายการ" : `เพิ่มรายการ`}</DialogTitle>
          <ExpenseAddEntryForm defaultValues={defaultValues} update={update} />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
