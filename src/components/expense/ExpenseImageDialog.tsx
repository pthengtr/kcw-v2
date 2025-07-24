import { ImageIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseType } from "./ExpenseColumn";
import { CellContext } from "@tanstack/react-table";
import { useContext, useEffect, useState } from "react";
import ImageCarousel, { getImageArray } from "../common/ImageCarousel";
import { ExpenseContext, ExpenseContextType } from "./ExpenseProvider";

type ExpenseImageDialogProps = {
  info: CellContext<ExpenseType, unknown>;
};

export default function ExpenseImageDialog({ info }: ExpenseImageDialogProps) {
  const [open, setOpen] = useState(false);

  const { receiptImageArray, setReceiptImageArray } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  useEffect(() => {
    if (open) {
      getImageArray("expense", `${info.row.original.id}`, setReceiptImageArray);
    }
  }, [info.row.original.id, open, setReceiptImageArray]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <ImageIcon strokeWidth={1} />
      </DialogTrigger>
      <DialogContent className="w-[80%] max-w-4xl">
        <DialogHeader>
          <DialogTitle>รูปใบเสร็จรับเงิน</DialogTitle>
          <DialogDescription></DialogDescription>
          <div className="grid place-content-center">
            <ImageCarousel
              imageFolder="expense"
              imageId={`${info.row.original.id}`}
              imageArray={receiptImageArray}
              setImageArray={setReceiptImageArray}
              triggerSize={500}
              dialogSize={750}
              disableDialog={true}
            />
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
