import Image from "next/image";
import { uploadKbImagesAction, deleteKbImageAction } from "../actions";
import type { KbPartImage } from "../types";
import { KbSubmitButton } from "./kb-submit-button";
import { KbConfirmSubmitButton } from "./kb-confirm-submit-button";

type KbImageManagerProps = {
  faqId?: number;
  images: KbPartImage[];
};

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KbImageManager({ faqId, images }: KbImageManagerProps) {
  if (!faqId) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        กรุณาบันทึก FAQ ก่อน แล้วจึงอัปโหลดรูปภาพ
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">รูปภาพ</div>
          <div className="text-xs text-muted-foreground">
            ที่เก็บไฟล์: <code>kb-parts/{faqId}/</code>
          </div>
        </div>

        <form action={uploadKbImagesAction} className="space-y-3">
          <input type="hidden" name="id" value={faqId} />
          <input
            type="file"
            name="images"
            accept="image/*"
            multiple
            className="block w-full text-sm"
          />
          <KbSubmitButton
            type="submit"
            idleText="อัปโหลดรูปภาพ"
            pendingText="กำลังอัปโหลด..."
          />
        </form>
      </div>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          ยังไม่มีรูปภาพ
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {images.map((image) => (
            <div key={image.path} className="rounded-lg border p-3 space-y-3">
              <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                <Image
                  src={image.publicUrl}
                  alt={image.name}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">{image.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(image.size)}
                </div>
              </div>

              <>
                <form
                  id={`kb-delete-image-${faqId}-${image.name}`}
                  action={deleteKbImageAction}
                >
                  <input type="hidden" name="id" value={faqId} />
                  <input type="hidden" name="path" value={image.path} />
                </form>

                <KbConfirmSubmitButton
                  formId={`kb-delete-image-${faqId}-${image.name}`}
                  triggerText="ลบรูปภาพ"
                  confirmText="ยืนยันการลบรูปภาพ"
                  title="ลบรูปภาพนี้ใช่หรือไม่?"
                  description={image.name}
                  variant="destructive"
                  size="sm"
                />
              </>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
