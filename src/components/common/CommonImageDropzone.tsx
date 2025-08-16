"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { ImagePlus, Upload, X, Images, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ---------- Utilities ----------

function extOf(file: File) {
  const n = file.name.split(".");
  return n.length > 1 ? n.pop()!.toLowerCase() : file.type.split("/").pop();
}

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

// ---------- Types ----------
export type UploadedObject = {
  path: string; // storage path within the bucket
  publicUrl?: string; // if makePublicUrl=true
};

export type CommonImageDropzoneProps = {
  folder: string;
  receiptUuid: string;
  bucket?: string;
  maxFiles?: number;
  maxSize?: number;
  makePublicUrl?: boolean;
  onUploaded?: (objects: UploadedObject[]) => void;
  className?: string;
};

// ---------- Upload-only Component ----------
export default function CommonImageDropzone({
  folder,
  receiptUuid,
  bucket = "pictures",
  maxFiles = 20,
  maxSize = 10 * 1024 * 1024,
  makePublicUrl = false,
  onUploaded,
  className,
}: CommonImageDropzoneProps) {
  const supabase = useMemo(() => createClient(), []);

  type Item = {
    id: string;
    file: File;
    preview: string;
    progress: number;
    status: "queued" | "uploading" | "done" | "error";
    path?: string;
    error?: string;
  };

  const [items, setItems] = useState<Item[]>([]);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list: File[] = Array.from(files);
      const accepted = list
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, Math.max(0, maxFiles - items.length));

      const tooBig: string[] = [];

      const newItems: Item[] = accepted.map((file) => {
        if (file.size > maxSize) {
          tooBig.push(`${file.name} > ${bytes(maxSize)}`);
        }
        return {
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          progress: 0,
          status: file.size > maxSize ? "error" : "queued",
          error:
            file.size > maxSize
              ? `File too large (max ${bytes(maxSize)})`
              : undefined,
        };
      });

      setItems((prev) => [...prev, ...newItems]);

      if (tooBig.length > 0) {
        console.warn(`Too large: ${tooBig.join(", ")}`);
      }
    },
    [items.length, maxFiles, maxSize]
  );

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      addFiles(e.target.files);
    },
    [addFiles]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
        e.dataTransfer.clearData();
      }
    },
    [addFiles]
  );

  const startUpload = useCallback(async () => {
    const queue = items.filter((i) => i.status === "queued");
    if (queue.length === 0) return;

    const uploaded: UploadedObject[] = [];

    for (const it of queue) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === it.id ? { ...p, status: "uploading", progress: 10 } : p
        )
      );

      try {
        const filename = `${crypto.randomUUID()}.${extOf(it.file) ?? "bin"}`;
        const path = `${folder}/${receiptUuid}/${filename}`;

        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, it.file, {
            contentType: it.file.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (error) {
          throw new Error(error.message ?? JSON.stringify(error));
        }

        let publicUrl: string | undefined = undefined;
        if (makePublicUrl) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          publicUrl = data.publicUrl;
        }

        uploaded.push({ path, publicUrl });

        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: "done", progress: 100, path } : p
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[storage.upload] failed:", message);
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id
              ? { ...p, status: "error", progress: 0, error: message }
              : p
          )
        );
      }
    }

    if (uploaded.length > 0) onUploaded?.(uploaded);
  }, [
    bucket,
    folder,
    items,
    makePublicUrl,
    onUploaded,
    receiptUuid,
    supabase.storage,
  ]);

  const clearItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.filter((p) => {
        if (p.id === id) URL.revokeObjectURL(p.preview);
        return p.id !== id;
      })
    );
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
  }, []);

  const canUpload = items.some((i) => i.status === "queued");

  return (
    <div className={"flex flex-col gap-4 " + (className ?? "")}>
      {/* Drop Area */}
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={onDrop}
        onClick={openPicker}
        role="button"
        aria-label="Upload images"
        className={
          "relative w-full border-dashed cursor-pointer transition select-none " +
          (isDragging ? "ring-2 ring-offset-2 ring-primary" : "hover:shadow-sm")
        }
      >
        <CardContent className="py-10 flex flex-col items-center text-center gap-2">
          <Images className="h-10 w-10" />
          <div className="text-lg font-medium">วางไฟล์ที่นี่...</div>
          <div className="text-sm text-muted-foreground">
            หรือ คลิกเพื่อเลือกไฟล์
          </div>
          <div className="text-xs text-muted-foreground">
            จำนวนไฟล์สูงสุด {maxFiles} ไฟล์ · {bytes(maxSize)} ต่อไฟล์
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onInputChange}
          />
        </CardContent>
        <CardFooter className="justify-center gap-2 pb-6">
          <Button size="sm" variant="secondary">
            <ImagePlus className="mr-2 h-4 w-4" /> เลือกไฟล์รูปภาพ
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Badge variant="outline">
            /{bucket}/{folder}/{receiptUuid}
          </Badge>
        </CardFooter>
      </Card>

      {/* Selected Items */}
      {items.length > 0 && (
        <ScrollArea className="h-auto max-h-[420px] rounded-md border">
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((it) => (
              <Card key={it.id} className="overflow-hidden relative">
                <CardContent className="p-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.preview}
                    alt={it.file.name}
                    className="h-36 w-full object-cover"
                  />
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-2">
                  <div className="flex items-center justify-between gap-2 w-full text-xs">
                    <div className="truncate" title={it.file.name}>
                      {it.file.name}
                    </div>
                    <div className="text-muted-foreground">
                      {bytes(it.file.size)}
                    </div>
                  </div>
                  {it.status === "uploading" && (
                    <Progress value={it.progress} className="h-2" />
                  )}
                  {it.status === "error" && (
                    <div className="text-red-600 text-xs">
                      {it.error ?? "Upload failed"}
                    </div>
                  )}
                  {it.status === "done" && (
                    <div className="text-green-600 text-xs">อัพโหลดแล้ว</div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearItem(it.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Actions */}
      <div className="flex justify-center items-center gap-2">
        <Button type="button" disabled={!canUpload} onClick={startUpload}>
          <Upload className="mr-2 h-4 w-4" /> อัพโหลด
        </Button>
        <Button type="button" variant="secondary" onClick={openPicker}>
          <ImagePlus className="mr-2 h-4 w-4" /> เพิ่ม
        </Button>
        <Button type="button" variant="ghost" onClick={clearAll}>
          <RotateCcw className="mr-2 h-4 w-4" /> เลือกใหม่
        </Button>
        {/* <div className="ml-auto text-sm text-muted-foreground">
          Destination:{" "}
          <span className="font-mono">
            /{bucket}/{folder}/{receiptUuid}
          </span>
        </div> */}
      </div>
    </div>
  );
}
