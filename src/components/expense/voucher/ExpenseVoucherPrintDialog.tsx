"use client";

import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import ExpenseVoucherA4 from "./ExpenseVoucherA4";
import { ExtendedExpenseReceiptType } from "@/lib/types/models";

type ExpenseVoucherPrintDialog = {
  extendedVouchers: ExtendedExpenseReceiptType[];
};

export default function ExpenseVoucherPrintDialog({
  extendedVouchers,
}: ExpenseVoucherPrintDialog) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "A4 Document",
    onAfterPrint: () => setOpen(false),
  });

  return (
    <div className="py-4">
      {/* Open Print Preview Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Printer /> พิมพ์ใบสำคัญจ่าย
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Print Preview</DialogTitle>
          </DialogHeader>

          {/* Printable Content  ref={printRef}*/}
          <ExpenseVoucherA4
            printRef={printRef}
            extendedVouchers={extendedVouchers}
          />

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePrint}>Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
