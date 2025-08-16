"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import CommonImagesCarousel from "./CommonImageCaroussel";
import CommonImageDropzone from "./CommonImageDropzone";

export type ImageManagerDialogProps = {
  receiptUuid: string;
  folder: string;
  bucket?: string;

  /** UI */
  title?: string;
  description?: string;
  trigger?: React.ReactNode; // ปุ่ม/องค์ประกอบที่ใช้เปิด Dialog เอง
  className?: string;

  /** ควบคุมการเปิดปิดจากภายนอกได้ (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** ตัวเลือกของ Carousel */
  listLimit?: number;
  preferSignedUrls?: boolean;
  signedUrlTTL?: number;
  showRefresh?: boolean;

  /** ตัวเลือกของ Dropzone */
  makePublicUrl?: boolean;
};

export default function CommonImageManagerDialog({
  receiptUuid,
  folder,
  bucket = "pictures",
  title = "จัดการไฟล์รูปภาพ",
  description = "ดูรูปที่อัปโหลด + ลาก/วางเพื่ออัปโหลดรูปใหม่",
  trigger,
  className,
  open,
  onOpenChange,

  // carousel
  listLimit = 100,
  preferSignedUrls = false,
  signedUrlTTL,
  showRefresh = true,

  // dropzone
  makePublicUrl,
}: ImageManagerDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = typeof open === "boolean";
  const dialogOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className={className}>
            จัดการรูปภาพ
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <CommonImagesCarousel
            folder={folder}
            receiptUuid={receiptUuid}
            bucket={bucket}
            listLimit={listLimit}
            preferSignedUrls={preferSignedUrls}
            signedUrlTTL={signedUrlTTL}
            showRefresh={showRefresh}
          />

          <CommonImageDropzone
            receiptUuid={receiptUuid}
            folder={folder}
            bucket={bucket}
            makePublicUrl={makePublicUrl}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
