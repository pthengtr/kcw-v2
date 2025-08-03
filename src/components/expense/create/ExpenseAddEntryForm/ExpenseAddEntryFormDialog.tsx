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
    createReceiptTab,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const _defaultValues: ExpenseAddEntryFormDefaultType =
    update && selectedEntry
      ? {
          item_id: selectedEntry.item_id.toString(),
          entry_detail: selectedEntry.entry_detail,
          unit_price: selectedEntry.unit_price,
          includeVat: false,
          quantity: selectedEntry.quantity,
          discount: selectedEntry.discount,
        }
      : expenseAddEntryFormDefaultValues;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { includeVat, discount, ...defaultValuesNovat } = _defaultValues;

  let defaultValues;
  if (createReceiptTab === "company") {
    defaultValues = _defaultValues;
  } else {
    defaultValues = defaultValuesNovat;
  }

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
