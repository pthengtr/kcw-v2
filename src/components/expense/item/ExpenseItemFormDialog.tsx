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
      <DialogContent className="max-w-fit">
        <DialogHeader className="grid place-content-center py-4">
          <DialogTitle>{dialogHeader}</DialogTitle>
        </DialogHeader>
        {submitError && (
          <div className="grid place-content-center w-full text-red-600">
            {submitError}
          </div>
        )}
        <div className=" h-full overflow-y-auto px-12">
          <ExpenseItemForm defaultValues={defaultValues} update={update} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
