import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useContext, useEffect } from "react";
import ExpenseGeneralCreateForm, {
  ExpenseGeneralFormDefaultType,
} from "./ExpenseGeneralCreateForm";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";

type ExpenseGeneralFormDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogTrigger: string | React.ReactNode;
  dialogHeader?: string | React.ReactNode;
  defaultValues: ExpenseGeneralFormDefaultType;
  update?: boolean;
};

export default function ExpenseGeneralFormDialog({
  open,
  setOpen,
  dialogTrigger,
  dialogHeader = dialogTrigger,
  defaultValues,
  update = false,
}: ExpenseGeneralFormDialogProps) {
  const {
    submitError,
    setSelectedPaymentMethod,
    selectedGeneralEntry,
    openUpdateExpenseGeneralDialog,
    openCreateExpenseGeneralDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  useEffect(() => {
    if (!selectedGeneralEntry) return;
    if (update) {
      setSelectedPaymentMethod(selectedGeneralEntry.payment_method);
    } else {
      setSelectedPaymentMethod(undefined);
    }
  }, [
    selectedGeneralEntry,
    setSelectedPaymentMethod,
    openUpdateExpenseGeneralDialog,
    openCreateExpenseGeneralDialog,
    update,
  ]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{dialogTrigger}</DialogTrigger>
      <DialogContent className="min-w-96">
        <DialogHeader className="grid place-content-center py-4">
          <DialogTitle>{dialogHeader}</DialogTitle>
        </DialogHeader>
        {submitError && (
          <div className="grid place-content-center w-full text-red-600">
            {submitError}
          </div>
        )}
        <div className=" h-full overflow-y-auto px-12">
          <ExpenseGeneralCreateForm
            defaultValues={defaultValues}
            update={update}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
