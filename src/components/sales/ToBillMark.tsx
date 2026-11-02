"use client";

import type { ToBillRef } from "@/lib/sales/to-bill";
import { isReceiptToBill, toBillCreateHref } from "@/lib/sales/to-bill";

export function ToBillMark({
  billno,
  rows,
  canCreate,
  createBaseUrl,
  onOpen,
}: {
  billno: string;
  rows?: ToBillRef[];
  canCreate: boolean;
  createBaseUrl: string;
  onOpen: (docno: string) => void;
}) {
  const list = (rows ?? []).filter((row) => row.status === "issued" || row.status === "draft");
  if (list.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      {list.map((row) => {
        const receipt = isReceiptToBill(row);
        const name = receipt ? "ใบเสร็จ" : "ใบกำกับ";
        const key = row.invoice_id || row.docno || name;
        if (row.status === "issued" && row.docno) {
          return (
            <button
              key={key}
              type="button"
              className="block text-left text-xs text-sky-800 underline"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(row.docno || "");
              }}
            >
              {name} {row.docno}
            </button>
          );
        }
        if (row.status === "draft" && canCreate && createBaseUrl) {
          return (
            <a
              key={key}
              className="block text-xs text-muted-foreground underline"
              href={toBillCreateHref(createBaseUrl, billno, receipt ? "rvo" : "to")}
            >
              {name} ฉบับร่าง
            </a>
          );
        }
        return null;
      })}
    </div>
  );
}
