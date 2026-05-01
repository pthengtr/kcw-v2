"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DeleteSubmitButtonProps = {
  label?: string;
};

function DeleteSubmitButton({ label = "ยืนยันลบ" }: DeleteSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction asChild>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
            กำลังลบ...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            {label}
          </>
        )}
      </button>
    </AlertDialogAction>
  );
}

type DeleteImageFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  bcode: string;
  path: string;
  slotNo: number;
};

export function DeleteImageForm({
  action,
  bcode,
  path,
  slotNo,
}: DeleteImageFormProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          ลบ
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันลบรูปสินค้า?</AlertDialogTitle>
          <AlertDialogDescription>
            ต้องการลบรูปช่อง {slotNo} ของสินค้า {bcode} ใช่ไหม?
            <br />
            ไฟล์นี้จะถูกลบออกจาก Supabase Storage
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={action}>
          <input type="hidden" name="bcode" value={bcode} />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="slotNo" value={String(slotNo)} />

          <AlertDialogFooter>
            <AlertDialogCancel type="button">ยกเลิก</AlertDialogCancel>
            <DeleteSubmitButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
