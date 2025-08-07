import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useContext } from "react";

import { SupplierContext, SupplierContextType } from "../SupplierProvider";
import SupplierTaxPayerForm, {
  SupplierTaxPayerFormDefaultType,
} from "./SupplierTaxPayerForm";

type SupplierFormDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogTrigger: string | React.ReactNode;
  dialogHeader?: string | React.ReactNode;
  defaultValues: SupplierTaxPayerFormDefaultType;
  update?: boolean;
};

export default function SupplierTaxPayerFormDialog({
  open,
  setOpen,
  dialogTrigger,
  dialogHeader = dialogTrigger,
  defaultValues,
  update = false,
}: SupplierFormDialogProps) {
  const { submitError } = useContext(SupplierContext) as SupplierContextType;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{dialogTrigger}</DialogTrigger>
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
          <SupplierTaxPayerForm defaultValues={defaultValues} update={update} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
