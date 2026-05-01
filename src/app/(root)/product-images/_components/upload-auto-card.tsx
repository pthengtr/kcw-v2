import { Camera, Upload } from "lucide-react";
import { uploadProductImageAutoAction } from "../actions";
import { PendingSubmitButton } from "./pending-submit-button";

export function UploadAutoCard({ bcode }: { bcode: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-slate-100 p-3">
          <Upload className="h-5 w-5" />
        </div>

        <div>
          <h3 className="font-semibold">เพิ่มรูปแบบอัตโนมัติ</h3>
          <p className="text-sm text-slate-500">
            เติมช่องว่างก่อน ถ้าครบ 5 รูปแล้วจะแทนรูปที่เก่าสุด
          </p>
        </div>
      </div>

      <form action={uploadProductImageAutoAction} className="mt-4 space-y-3">
        <input type="hidden" name="bcode" value={bcode} />

        <input
          type="file"
          name="image"
          accept="image/*"
          className="block w-full rounded-xl border border-dashed p-3 text-sm"
          required
        />

        <PendingSubmitButton
          pendingText="กำลังอัปโหลด..."
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white"
        >
          <Camera className="h-4 w-4" />
          เพิ่มรูป
        </PendingSubmitButton>
      </form>
    </div>
  );
}
