import Image from "next/image";
import { ImageIcon, RefreshCw } from "lucide-react";

import type { ProductImageSlot } from "../types";
import {
  deleteProductImageSlotAction,
  replaceProductImageSlotAction,
} from "../actions";
import { DeleteImageForm } from "./delete-image-form";
import { PendingSubmitButton } from "./pending-submit-button";
import { formatDate, formatSize } from "./formatters";

export function ProductImageSlotCard({
  bcode,
  slot,
}: {
  bcode: string;
  slot: ProductImageSlot;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">{slot.label}</h3>
          <p className="text-xs text-slate-500">{slot.filename}</p>
        </div>

        {slot.isOldest ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
            เก่าสุด
          </span>
        ) : null}
      </div>

      <div className="bg-slate-50 p-3">
        {slot.exists && slot.publicUrl ? (
          <a href={slot.publicUrl} target="_blank" rel="noreferrer">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-white">
              <Image
                src={slot.publicUrl}
                alt={`${bcode} ${slot.label}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 220px"
                className="object-contain"
              />
            </div>
          </a>
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed bg-white text-slate-400">
            <ImageIcon className="h-10 w-10" />
            <p className="mt-2 text-sm">ยังไม่มีรูป</p>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div>
            <p>อัปเดต</p>
            <p className="font-medium text-slate-700">
              {formatDate(slot.updatedAt)}
            </p>
          </div>

          <div>
            <p>ขนาด</p>
            <p className="font-medium text-slate-700">
              {formatSize(slot.size)}
            </p>
          </div>
        </div>

        <form action={replaceProductImageSlotAction} className="space-y-2">
          <input type="hidden" name="bcode" value={bcode} />
          <input type="hidden" name="path" value={slot.path} />
          <input type="hidden" name="slotNo" value={String(slot.slotNo)} />

          <input
            type="file"
            name="image"
            accept="image/*"
            className="block w-full rounded-xl border border-dashed p-2 text-xs"
            required
          />

          <PendingSubmitButton
            pendingText={slot.exists ? "กำลังแทนที่..." : "กำลังอัปโหลด..."}
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            {slot.exists ? "แทนที่" : "อัปโหลดช่องนี้"}
          </PendingSubmitButton>
        </form>

        {slot.exists ? (
          <DeleteImageForm
            action={deleteProductImageSlotAction}
            bcode={bcode}
            path={slot.path}
            slotNo={slot.slotNo}
          />
        ) : null}
      </div>
    </div>
  );
}
