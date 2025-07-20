import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import ReminderForm from "./ReminderForm";
import { Button } from "../ui/button";
import { useContext } from "react";
import { ReminderDefaultValueType } from "./ReminderColumn";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";

type ReminderFormDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  dialogTrigger: string | React.ReactNode;
  dialogHeader?: string | React.ReactNode;
  defaultValues: ReminderDefaultValueType;
  update?: boolean;
};

export default function ReminderFormDialog({
  open,
  setOpen,
  dialogTrigger,
  dialogHeader = dialogTrigger,
  defaultValues,
  update = false,
}: ReminderFormDialogProps) {
  const { submitError } = useContext(ReminderContext) as ReminderContextType;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button id="create-reminder">{dialogTrigger}</Button>
      </DialogTrigger>
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
          <ReminderForm defaultValues={defaultValues} update={update} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
