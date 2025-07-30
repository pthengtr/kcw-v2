import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useContext } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import ExpenseCreateReceiptForm, {
  expenseCreateReceiptFormDefaultValues,
} from "./ExpenseCreateReceiptForm";

type ExpenseCreateReceiptFormDialogProps = {
  vat?: boolean;
};

export default function ExpenseCreateReceiptFormDialog({
  vat = false,
}: ExpenseCreateReceiptFormDialogProps) {
  const {
    openCreateVatReceiptDialog,
    setOpenCreateVatReceiptDialog,
    openCreateNoVatReceiptDialog,
    setOpenCreateNoVatReceiptDialog,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invoice_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invoice_date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tax_invoice_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tax_invoice_date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    receipt_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    receipt_date,
    ...noVatDefaultValues
  } = expenseCreateReceiptFormDefaultValues;

  const defaultValues = vat
    ? expenseCreateReceiptFormDefaultValues
    : noVatDefaultValues;

  return (
    <Dialog
      open={vat ? openCreateVatReceiptDialog : openCreateNoVatReceiptDialog}
      onOpenChange={
        vat ? setOpenCreateVatReceiptDialog : setOpenCreateNoVatReceiptDialog
      }
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> {vat ? "บริษัท" : "ทั่วไป"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex flex-col gap-4">
          <DialogTitle>{`สร้างบิลค่าใช้จ่าย$${
            vat ? "บริษัท" : "ทั่วไป"
          }`}</DialogTitle>
          <ExpenseCreateReceiptForm defaultValues={defaultValues} />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
