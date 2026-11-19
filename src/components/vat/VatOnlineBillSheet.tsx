"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { receiptTitle } from "@/lib/vat/generated-bill";
import type { VatRegisterRow } from "@/lib/vat/register";

export default function VatOnlineBillSheet({ row }: { row: VatRegisterRow }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const title = receiptTitle(row.sheet);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const params = new URLSearchParams({
      billno: row.bill_no,
      sheet: row.sheet,
      // Bust browser/CDN cache after online-sale sheet format changes.
      t: String(Date.now()),
    });
    setLoading(true);
    setError(null);
    setSrc(null);
    void fetch(`/api/vat/online-bill?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(json?.error || "โหลดบิลจากขายออนไลน์ไม่สำเร็จ");
        }
        const html = await res.text();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          new Blob([html], { type: "text/html;charset=utf-8" })
        );
        setSrc(objectUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "โหลดบิลไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.bill_no, row.sheet]);

  function printBill() {
    const frame = document.getElementById(
      "vat-online-bill-frame"
    ) as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  }

  return (
    <section className="grid gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit print:hidden"
        disabled={loading || Boolean(error) || !src}
        onClick={printBill}
      >
        <Printer className="h-4 w-4" />
        พิมพ์
      </Button>
      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลดบิลจากขายออนไลน์</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {src ? (
        <iframe
          id="vat-online-bill-frame"
          title={`${title} ${row.bill_no}`}
          src={src}
          className="min-h-[70vh] w-full rounded border border-slate-200 bg-white"
        />
      ) : null}
    </section>
  );
}
