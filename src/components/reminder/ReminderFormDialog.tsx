"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useContext, useEffect, useState } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import PaymentReminderForm from "./PaymentReminderForm";
import { createClient } from "@/lib/supabase/client";
import { PaymentReminderRow } from "@/lib/types/models";

type ReminderFormDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogTrigger: string | React.ReactNode;
  dialogHeader?: string | React.ReactNode;
  update?: boolean;
};

export default function ReminderFormDialog({
  open,
  setOpen,
  dialogTrigger,
  dialogHeader = dialogTrigger,
  update = false,
}: ReminderFormDialogProps) {
  const { submitError, selectedRow, setSelectedRow } = useContext(
    ReminderContext
  ) as ReminderContextType;

  const [currentUserId, setCurrentUserId] = useState<string>();

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();

      const {
        data: { user },
        error: errorUser,
      } = await supabase.auth.getUser();

      if (!user || errorUser) {
        console.log("No user logged in or error:", errorUser);
        return;
      }
      setCurrentUserId(user.email);
    }

    getUser();
  });

  function handleOnsavedForm(row: PaymentReminderRow) {
    setOpen(false);
    setSelectedRow?.(row);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{dialogTrigger}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg h-[90dvh] overflow-x-hidden p-3 sm:p-6 sm:max-w-3xl sm:w-[90vw] md:max-w-5xl md:w-[60vw] md:h-5/6">
        <DialogHeader className="grid place-content-center py-2 sm:py-4 pr-8">
          <DialogTitle>{dialogHeader}</DialogTitle>
        </DialogHeader>
        {submitError && (
          <div className="grid place-content-center w-full text-red-600">
            {submitError}
          </div>
        )}
        <div className="w-full min-w-0 h-full overflow-x-hidden overflow-y-auto">
          {currentUserId && (
            <PaymentReminderForm
              open={open}
              className="flex flex-col gap-6 items-stretch p-2 sm:p-8"
              currentUserId={currentUserId}
              defaultPartyKind="SUPPLIER"
              onSaved={(row) => handleOnsavedForm(row)}
              {...(update && selectedRow
                ? { mode: "edit" as const, value: selectedRow }
                : { mode: "create" as const })}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
