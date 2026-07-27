import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useContext } from "react";
import ExpenseItemForm, { ExpenseItemDefaultType } from "./ExpenseItemForm";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { Button } from "@/components/ui/button";

type ExpenseItemFormDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogTrigger: string | React.ReactNode;
  dialogHeader?: string | React.ReactNode;
  defaultValues: ExpenseItemDefaultType;
  update?: boolean;
};

export default function ExpenseItemFormDialog({
  open,
  setOpen,
  dialogTrigger,
  dialogHeader = dialogTrigger,
  defaultValues,
  update = false,
}: ExpenseItemFormDialogProps) {
  const { submitError } = useContext(ExpenseContext) as ExpenseContextType;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{dialogTrigger}</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden sm:max-w-fit">
        <DialogHeader className="grid shrink-0 place-content-center py-4">
          <DialogTitle>{dialogHeader}</DialogTitle>
        </DialogHeader>
        {submitError && (
          <div className="grid w-full shrink-0 place-content-center text-red-600">
            {submitError}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 sm:px-12">
          <ExpenseItemForm defaultValues={defaultValues} update={update} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
