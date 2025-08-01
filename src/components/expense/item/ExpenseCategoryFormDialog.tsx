import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpenseCategoryForm, {
  ExpenseCategoryDefaultType,
} from "./ExpenseCategoryForm";
import { Button } from "@/components/ui/button";

type ExpenseCategoryFormDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogTrigger: string | React.ReactNode;
  dialogHeader?: string | React.ReactNode;
  defaultValues: ExpenseCategoryDefaultType;
  update?: boolean;
};

export default function ExpenseCategoryFormDialog({
  open,
  setOpen,
  dialogTrigger,
  dialogHeader = dialogTrigger,
  defaultValues,
  update = false,
}: ExpenseCategoryFormDialogProps) {
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
          <ExpenseCategoryForm defaultValues={defaultValues} update={update} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
