"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { X, Upload } from "lucide-react";
import clsx from "clsx";

export type LocalImageDropzoneProps = {
  /** Controlled value (optional). If provided, component becomes controlled. */
  value?: File[];
  /** Called whenever the internal file list changes. */
  onChange?: (files: File[]) => void;

  /** Accept images only by default */
  accept?: Record<string, string[]>;
  /** Maximum file size in bytes (optional) */
  maxSize?: number;
  /** Allow multiple files (default: true) */
  multiple?: boolean;

  /** Optional classNames */
  className?: string;
  dropAreaClassName?: string;
  gridClassName?: string;

  /** Prevent duplicate files by name+size (default: true) */
  preventDuplicates?: boolean;

  /** Start with these files (uncontrolled only) */
  defaultFiles?: File[];
};

type Preview = {
  file: File;
  /** For quick preview */
  objectUrl: string;
  /** Simple id for react list keys */
  id: string;
};

export function LocalImageDropzone({
  value,
  onChange,
  accept = { "image/*": [] },
  maxSize,
  multiple = true,
  className,
  dropAreaClassName,
  gridClassName,
  preventDuplicates = true,
  defaultFiles = [],
}: LocalImageDropzoneProps) {
  const isControlled = Array.isArray(value);
  const [files, setFiles] = React.useState<File[]>(defaultFiles);

  const list = isControlled ? value! : files;

  const setList = React.useCallback(
    (next: File[]) => {
      if (isControlled) onChange?.(next);
      else setFiles(next);
    },
    [isControlled, onChange]
  );

  const [previews, setPreviews] = React.useState<Preview[]>([]);

  // Build/cleanup object URLs for thumbnails
  React.useEffect(() => {
    const next: Preview[] = list.map((f, i) => ({
      file: f,
      objectUrl: URL.createObjectURL(f),
      id: `${f.name}-${f.size}-${i}`,
    }));
    setPreviews(next);
    return () => next.forEach((p) => URL.revokeObjectURL(p.objectUrl));
  }, [list]);

  const addFiles = React.useCallback(
    (incoming: File[]) => {
      let merged = [...list, ...incoming];

      if (preventDuplicates) {
        const seen = new Set<string>();
        merged = merged.filter((f) => {
          const key = `${f.name}:${f.size}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      setList(merged);
    },
    [list, preventDuplicates, setList]
  );

  const removeAt = React.useCallback(
    (idx: number) => {
      const next = list.filter((_, i) => i !== idx);
      setList(next);
    },
    [list, setList]
  );

  const clearAll = React.useCallback(() => setList([]), [setList]);

  const onDrop = React.useCallback(
    (accepted: File[]) => {
      if (!multiple && accepted.length > 0) {
        setList([accepted[0]]);
        return;
      }
      addFiles(accepted);
    },
    [addFiles, multiple, setList]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
  });

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Drop Area */}
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer",
          "transition-colors",
          isDragActive ? "border-primary" : "border-muted",
          dropAreaClassName
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6" />
          {isDragActive ? (
            <p className="text-sm text-primary font-medium">Drop files here…</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              วางรูปภาพที่นี่ หรือ คลิกเพื่อค้นหาไฟล์
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {multiple
              ? "สามารถเลือกได้มากกว่าหนึ่งไฟล์"
              : "รองรับหนี่งไฟล์เท่านั้น"}
          </p>
        </div>
      </div>

      {/* Selected Files Grid */}
      {list.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Selected {list.length} {list.length > 1 ? "files" : "file"}
            </div>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          </div>

          <div
            className={clsx(
              "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3",
              gridClassName
            )}
          >
            {previews.map((p, idx) => (
              <div
                key={p.id}
                className="relative border rounded-lg overflow-hidden bg-muted/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.objectUrl}
                  alt={p.file.name}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="absolute top-1 right-1 inline-flex items-center justify-center
                             h-7 w-7 rounded-full bg-background/90 border shadow"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="px-2 py-1 text-xs truncate">{p.file.name}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
