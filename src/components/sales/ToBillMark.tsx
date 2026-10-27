"use client";

import type { ToBillRef } from "@/lib/sales/to-bill";
import { toBillCreateHref } from "@/lib/sales/to-bill";

export function ToBillMark({
  billno,
  row,
  canCreate,
  createBaseUrl,
  onOpen,
}: {
  billno: string;
  row?: ToBillRef;
  canCreate: boolean;
  createBaseUrl: string;
  onOpen: (docno: string) => void;
}) {
  if (row?.status === "issued" && row.docno) {
    return (
      <button
        type="button"
        className="mt-1 block text-left text-xs text-sky-800 underline"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(row.docno || "");
        }}
      >
        ใบเต็ม {row.docno}
      </button>
    );
  }
  if (row?.status === "draft" && canCreate && createBaseUrl) {
    return (
      <a
        className="mt-1 block text-xs text-muted-foreground underline"
        href={toBillCreateHref(createBaseUrl, billno)}
      >
        ฉบับร่าง
      </a>
    );
  }
  return null;
}
