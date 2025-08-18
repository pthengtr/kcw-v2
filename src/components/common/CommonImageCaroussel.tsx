"use client";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export type CommonImagesCarouselProps = {
  folder: string;
  receiptUuid: string;
  bucket?: string;
  listLimit?: number;
  preferSignedUrls?: boolean;
  signedUrlTTL?: number;
  className?: string;
  showRefresh?: boolean;

  // NEW
  enableDelete?: boolean;
  onDeleted?: (path: string) => void;
};

type ObjItem = {
  url: string; // public or signed url for display
  path: string; // bucket path for deletion
  name: string; // file name for UI
};

export default function CommonImagesCarousel({
  folder,
  receiptUuid,
  bucket = "pictures",
  listLimit = 100,
  preferSignedUrls = false,
  signedUrlTTL = 3600,
  className,
  showRefresh = true,

  // NEW
  enableDelete = true,
  onDeleted,
}: CommonImagesCarouselProps) {
  const supabase = useMemo(() => createClient(), []);
  const storage = useMemo(() => supabase.storage, [supabase]);

  const [images, setImages] = useState<ObjItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = useCallback((i: number) => {
    setIndex(i);
    setOpen(true);
  }, []);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % Math.max(1, images.length)),
    [images.length]
  );
  const prev = useCallback(
    () =>
      setIndex(
        (i) => (i - 1 + Math.max(1, images.length)) % Math.max(1, images.length)
      ),
    [images.length]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const prefix = `${folder}/${receiptUuid}`;
      const { data, error } = await storage.from(bucket).list(prefix, {
        limit: listLimit,
        offset: 0,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (error) throw new Error(error.message ?? JSON.stringify(error));

      const items: ObjItem[] = [];
      for (const f of data ?? []) {
        const mm = f?.metadata?.mimetype as string | undefined;
        const isImg =
          mm?.startsWith?.("image/") ||
          /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i.test(f.name);
        if (!isImg) continue;

        const path = `${prefix}/${f.name}`;
        if (preferSignedUrls) {
          const { data: s } = await storage
            .from(bucket)
            .createSignedUrl(path, signedUrlTTL);
          if (s?.signedUrl)
            items.push({ url: s.signedUrl, path, name: f.name });
        } else {
          const { data: p } = storage.from(bucket).getPublicUrl(path);
          if (p?.publicUrl)
            items.push({ url: p.publicUrl, path, name: f.name });
        }
      }
      setImages(items);
      setIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)));
    } catch (e) {
      console.error("[storage.list] failed", e);
    } finally {
      setLoading(false);
    }
  }, [
    folder,
    receiptUuid,
    storage,
    bucket,
    listLimit,
    preferSignedUrls,
    signedUrlTTL,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev]);

  const hasImages = images.length > 0;
  const current = hasImages ? images[index] : undefined;

  function handlePrint(src: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
    <html>
      <head>
        <title>Print Image</title>
        <style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
          img { max-width: 100%; max-height: 100%; }
        </style>
      </head>
      <body>
        <img src="${src}" />
        <script>window.onload = () => window.print();</script>
      </body>
    </html>`);
    win.document.close();
  }

  const deleteByIndex = useCallback(
    async (i: number) => {
      const item = images[i];
      if (!item) return;

      // optimistic remove
      setImages((prev) => prev.filter((_, idx) => idx !== i));
      setIndex((prev) => {
        const len = images.length - 1; // after removal
        if (len <= 0) return 0;
        // keep index within range; when deleting current last item, step back
        return Math.min(prev, len - 1);
      });

      const { error } = await storage.from(bucket).remove([item.path]);
      if (error) {
        console.error("[storage.remove] failed", error.message ?? error);
        // rollback if deletion fails
        setImages((prev) => {
          const copy = [...prev];
          copy.splice(i, 0, item);
          return copy;
        });
        return;
      }

      onDeleted?.(item.path);
    },
    [images, storage, bucket, onDeleted]
  );

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">รูปที่ลิงก์กับรายการนี้</div>
        <div className="flex items-center gap-2">
          {showRefresh && (
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={loading}
              title="Refresh list"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">กำลังโหลด…</div>
      ) : !hasImages ? (
        <div className="text-sm text-muted-foreground">ไม่พบรูปภาพ...</div>
      ) : (
        <Carousel className="w-full max-w-xl mx-auto">
          <CarouselContent>
            {images.map((item, idx) => (
              <CarouselItem key={item.path}>
                <Card>
                  <CardContent className="p-0">
                    <button
                      type="button"
                      className="w-full group relative"
                      onClick={() => openAt(idx)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.name}
                        className="h-64 w-full object-contain"
                      />
                    </button>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {hasImages ? `${index + 1} / ${images.length}` : ""}
            </DialogTitle>
          </DialogHeader>

          {hasImages && current && (
            <>
              <div className="relative w-full flex items-center justify-center">
                <Button
                  type="button"
                  onClick={prev}
                  variant="outline"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt={current.name}
                  className="max-h-[80vh] w-auto object-contain"
                />
                <Button
                  type="button"
                  onClick={next}
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm underline"
                  title="Open / Download"
                >
                  <Download className="h-4 w-4" />
                  ดาวโหลด
                </a>

                <button
                  type="button"
                  onClick={() => handlePrint(current.url)}
                  className="inline-flex items-center gap-2 text-sm underline"
                  title="Print"
                >
                  <Printer className="h-4 w-4" />
                  พิมพ์
                </button>

                {enableDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="inline-flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        ลบ
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ลบรูปภาพนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                          การกระทำนี้จะลบ{" "}
                          <span className="font-medium">{current.name}</span>{" "}
                          ออกจาก <code>{bucket}</code> อย่างถาวร
                          และไม่สามารถกู้คืนได้
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteByIndex(index)}>
                          ยืนยันการลบ
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
