"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PoAccountDetail } from "@/lib/po/po-queries";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm sm:grid-cols-[8.5rem_1fr]">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words">{value?.trim() ? value : "—"}</div>
    </div>
  );
}

export default function PoAccountDialog({
  open,
  onOpenChange,
  acctno,
  site,
  docno,
  fallbackName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acctno: string | null;
  site: PoSyncSite;
  docno?: string | null;
  fallbackName?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<PoAccountDetail | null>(null);

  useEffect(() => {
    if (!open || !acctno?.trim()) {
      setAccount(null);
      setError(null);
      setLoading(false);
      return;
    }

    const code = acctno.trim();
    const ac = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("site", site);
        if (docno?.trim()) params.set("docno", docno.trim());
        const res = await fetch(
          `/api/po/account/${encodeURIComponent(code)}?${params}`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as { account: PoAccountDetail | null };
        setAccount(data.account);
      } catch (e) {
        if (String(e).includes("AbortError")) return;
        setError(e instanceof Error ? e.message : String(e));
        setAccount(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
    return () => ac.abort();
  }, [open, acctno, site, docno]);

  const titleAcct = acctno?.trim() || "—";
  const titleName =
    account?.acctname?.trim() ||
    fallbackName?.trim() ||
    account?.po_snapshot?.acctname?.trim() ||
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            บัญชี {titleAcct}
            {titleName ? (
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {titleName}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !error ? (
          <div className="space-y-3">
            <Field label="รหัสบัญชี" value={account?.acctno ?? acctno} />
            <Field
              label="ชื่อ"
              value={account?.acctname ?? fallbackName ?? null}
            />
            <Field label="ที่อยู่ 1" value={account?.addr1} />
            <Field label="ที่อยู่ 2" value={account?.addr2} />
            <Field label="โทรศัพท์" value={account?.phone} />
            <Field label="เลขผู้เสียภาษี" value={account?.tax_id} />
            <Field label="แฟ็กซ์" value={account?.fax} />
            <Field label="ผู้ติดต่อ" value={account?.contact} />
            <Field label="อีเมล" value={account?.email} />
            <Field label="เครดิต (วัน)" value={account?.term} />
            <Field label="หมายเหตุ" value={account?.remarks} />
            {account?.source === "po_only" ? (
              <p className="text-xs text-muted-foreground">
                ไม่พบใน APMAS — แสดงจากข้อมูลบนใบ PO
              </p>
            ) : null}
            {account?.po_snapshot ? (
              <div className="space-y-2 border-t pt-3">
                <div className="text-sm font-medium">
                  บนใบ PO {account.po_snapshot.docno}
                </div>
                <Field label="ชื่อบนใบ" value={account.po_snapshot.acctname} />
                <Field label="ที่อยู่ 1" value={account.po_snapshot.addr1} />
                <Field label="ที่อยู่ 2" value={account.po_snapshot.addr2} />
                <Field label="ATTN" value={account.po_snapshot.attn} />
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
