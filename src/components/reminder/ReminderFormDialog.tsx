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
import { useRouter } from "next/navigation";

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
  const { submitError } = useContext(ReminderContext) as ReminderContextType;

  const [currentUserId, setCurrentUserId] = useState<string>();

  const router = useRouter();

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{dialogTrigger}</DialogTrigger>
      <DialogContent className="max-w-fit  h-5/6">
        <DialogHeader className="grid place-content-center py-4">
          <DialogTitle>{dialogHeader}</DialogTitle>
        </DialogHeader>
        {submitError && (
          <div className="grid place-content-center w-full text-red-600">
            {submitError}
          </div>
        )}
        <div className="w-[60vw] h-full overflow-y-auto">
          {currentUserId && (
            <PaymentReminderForm
              className="flex flex-col gap-6 items-stretch p-8"
              mode={update ? "edit" : "create"}
              currentUserId={currentUserId}
              defaultPartyKind="SUPPLIER"
              onSaved={() => router.push("/reminder")}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
