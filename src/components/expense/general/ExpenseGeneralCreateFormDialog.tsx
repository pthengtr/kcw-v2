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
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden sm:min-w-96">
        <DialogHeader className="grid shrink-0 place-content-center py-4">
          <DialogTitle>{dialogHeader}</DialogTitle>
        </DialogHeader>
        {submitError && (
          <div className="grid w-full shrink-0 place-content-center text-red-600">
            {submitError}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 sm:px-12">
          <ExpenseGeneralCreateForm
            defaultValues={defaultValues}
            update={update}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
